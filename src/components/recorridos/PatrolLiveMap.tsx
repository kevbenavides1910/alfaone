"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Popup,
  CircleMarker,
  Polyline,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatDateTime } from "@/lib/utils/format";

export type MapDevice = {
  deviceId: string;
  imei: string;
  employeeCode: string;
  label: string | null;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
  recordedAt: string | null;
  status: "online" | "stale" | "offline" | "no_signal";
  source: "gps_track" | "nfc_mark" | null;
};

export type MapTrailPoint = {
  latitude: number;
  longitude: number;
  recordedAt: string;
};

export type MapTrail = {
  deviceId: string;
  label: string | null;
  employeeCode: string;
  color: string;
  /** @deprecated use trailPoints — kept for backward compatibility */
  points?: [number, number][];
  trailPoints: MapTrailPoint[];
  pointCount: number;
  /** Trazos ajustados a calles (OpenStreetMap / OSRM). */
  roadPaths?: { latitude: number; longitude: number }[][];
};

function trailDrawPaths(trail: MapTrail): [number, number][][] {
  if (trail.roadPaths?.length) {
    return trail.roadPaths
      .filter((path) => path.length >= 2)
      .map((path) => path.map((p) => [p.latitude, p.longitude] as [number, number]));
  }
  const line = trailLatLngs(trail);
  return line.length >= 2 ? [line] : [];
}

const STATUS_COLOR: Record<MapDevice["status"], string> = {
  online: "#16a34a",
  stale: "#ca8a04",
  offline: "#6b7280",
  no_signal: "#9ca3af",
};

const STATUS_LABEL: Record<MapDevice["status"], string> = {
  online: "En linea",
  stale: "Senal antigua",
  offline: "Sin senal reciente",
  no_signal: "Sin ubicacion",
};

const TRAIL_COLORS = [
  "#2563eb",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#be185d",
  "#059669",
  "#4338ca",
];

type TrailSegment = {
  key: string;
  mid: [number, number];
  bearing: number;
  recordedAt: string;
  fromAt: string;
  color: string;
};

function trailLatLngs(trail: MapTrail): [number, number][] {
  if (trail.trailPoints.length > 0) {
    return trail.trailPoints.map((p) => [p.latitude, p.longitude]);
  }
  return trail.points ?? [];
}

function segmentDistanceMeters(a: MapTrailPoint, b: MapTrailPoint): number {
  const R = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function bearingDegrees(from: MapTrailPoint, to: MapTrailPoint): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function buildTrailSegments(trail: MapTrail): TrailSegment[] {
  const pts = trail.trailPoints;
  if (pts.length < 2) return [];

  const raw: TrailSegment[] = [];

  for (let i = 0; i < pts.length - 1; i += 1) {
    const from = pts[i];
    const to = pts[i + 1];
    const dist = segmentDistanceMeters(from, to);
    if (dist < 8) continue;

    raw.push({
      key: `${trail.deviceId}-${i}-${to.recordedAt}`,
      mid: [(from.latitude + to.latitude) / 2, (from.longitude + to.longitude) / 2],
      bearing: bearingDegrees(from, to),
      recordedAt: to.recordedAt,
      fromAt: from.recordedAt,
      color: trail.color,
    });
  }

  const maxArrows = 160;
  if (raw.length <= maxArrows) return raw;
  const step = Math.ceil(raw.length / maxArrows);
  return raw.filter((_, index) => index % step === 0);
}

function arrowIcon(bearing: number, color: string): L.DivIcon {
  return L.divIcon({
    className: "patrol-trail-arrow-icon",
    html: `<div class="patrol-trail-arrow" style="--bearing:${bearing}deg;--arrow-color:${color};" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
        <path fill="currentColor" d="M12 2 L20 20 L12 16 L4 20 Z"/>
      </svg>
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function FitBounds({
  devices,
  trails,
  fitKey,
  showTrailLines = true,
}: {
  devices: MapDevice[];
  trails: MapTrail[];
  fitKey: string;
  showTrailLines?: boolean;
}) {
  const map = useMap();
  const lastFitKey = useRef<string | null>(null);

  const points = useMemo(() => {
    const fromDevices = devices
      .filter((d) => d.latitude != null && d.longitude != null)
      .map((d) => [d.latitude!, d.longitude!] as [number, number]);
    const fromTrails = trails.flatMap((t) =>
      showTrailLines ? trailDrawPaths(t).flat() : trailLatLngs(t),
    );
    return [...fromDevices, ...fromTrails];
  }, [devices, trails, showTrailLines]);

  useEffect(() => {
    if (lastFitKey.current === fitKey) return;
    if (points.length === 0) return;

    lastFitKey.current = fitKey;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 });
  }, [map, fitKey, points]);

  return null;
}

function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 0);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  return null;
}

function TrailDirectionArrows({ trails }: { trails: MapTrail[] }) {
  const segments = useMemo(
    () => trails.flatMap((trail) => buildTrailSegments(trail)),
    [trails],
  );

  return (
    <>
      {segments.map((seg) => (
        <Marker
          key={seg.key}
          position={seg.mid}
          icon={arrowIcon(seg.bearing, seg.color)}
          interactive
          zIndexOffset={400}
        >
          <Tooltip
            direction="top"
            offset={[0, -6]}
            opacity={0.95}
            sticky
            className="patrol-trail-arrow-tooltip"
          >
            <span className="text-xs font-medium">
              {formatDateTime(seg.recordedAt)}
            </span>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

export function PatrolLiveMap({
  devices,
  trails = [],
  showTrails = true,
  showTrailLines = true,
  fitKey,
}: {
  devices: MapDevice[];
  trails?: MapTrail[];
  showTrails?: boolean;
  /** Si false, solo flechas de direccion (sin polyline). */
  showTrailLines?: boolean;
  fitKey: string;
}) {
  const withCoords = devices.filter((d) => d.latitude != null && d.longitude != null);
  const visibleTrails = showTrails
    ? trails.filter((t) => trailLatLngs(t).length >= 2)
    : [];
  const allPoints = [
    ...withCoords.map((d) => [d.latitude!, d.longitude!] as [number, number]),
    ...visibleTrails.flatMap((t) =>
      showTrailLines ? trailDrawPaths(t).flat() : trailLatLngs(t),
    ),
  ];
  const center: [number, number] =
    allPoints.length > 0 ? allPoints[0] : [9.9281, -84.0909];

  return (
    <>
      <style>{`
        .patrol-trail-arrow-icon {
          background: transparent !important;
          border: none !important;
        }
        .patrol-trail-arrow {
          color: var(--arrow-color, #2563eb);
          transform: rotate(var(--bearing, 0deg));
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
          cursor: pointer;
          pointer-events: auto;
        }
        .patrol-trail-arrow svg {
          display: block;
        }
        .leaflet-tooltip.patrol-trail-arrow-tooltip {
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 6px;
          white-space: nowrap;
        }
      `}</style>
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full rounded-lg z-0"
        style={{ minHeight: 480 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        <MapResizeFix />
        <FitBounds
          devices={devices}
          trails={visibleTrails}
          fitKey={fitKey}
          showTrailLines={showTrailLines}
        />
        {showTrailLines
          ? visibleTrails.flatMap((trail) =>
              trailDrawPaths(trail).map((positions, segmentIndex) => (
                <Polyline
                  key={`${trail.deviceId}-${segmentIndex}`}
                  positions={positions}
                  pathOptions={{
                    color: trail.color,
                    weight: 4,
                    opacity: 0.75,
                  }}
                />
              )),
            )
          : null}
        <TrailDirectionArrows trails={visibleTrails} />
        {withCoords.map((d) => (
          <CircleMarker
            key={d.deviceId}
            center={[d.latitude!, d.longitude!]}
            radius={10}
            pathOptions={{
              color: STATUS_COLOR[d.status],
              fillColor: STATUS_COLOR[d.status],
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm space-y-1 min-w-[180px]">
                <p className="font-semibold">{d.label ?? d.employeeCode}</p>
                <p>Empleado: {d.employeeCode}</p>
                <p>IMEI: {d.imei}</p>
                <p>
                  Estado:{" "}
                  <span style={{ color: STATUS_COLOR[d.status] }}>
                    {STATUS_LABEL[d.status]}
                  </span>
                </p>
                {d.recordedAt ? (
                  <p>Ultima posicion: {formatDateTime(d.recordedAt)}</p>
                ) : null}
                {d.source ? (
                  <p className="text-xs text-muted-foreground">
                    Fuente: {d.source === "gps_track" ? "GPS continuo" : "Marca NFC"}
                  </p>
                ) : null}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </>
  );
}

export function trailColorForIndex(index: number): string {
  return TRAIL_COLORS[index % TRAIL_COLORS.length];
}
