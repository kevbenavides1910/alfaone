"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Popup, CircleMarker, Polyline, useMap } from "react-leaflet";
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

export type MapTrail = {
  deviceId: string;
  label: string | null;
  employeeCode: string;
  color: string;
  points: [number, number][];
  pointCount: number;
};

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

function FitBounds({
  devices,
  trails,
}: {
  devices: MapDevice[];
  trails: MapTrail[];
}) {
  const map = useMap();
  const points = useMemo(() => {
    const fromDevices = devices
      .filter((d) => d.latitude != null && d.longitude != null)
      .map((d) => [d.latitude!, d.longitude!] as [number, number]);
    const fromTrails = trails.flatMap((t) => t.points);
    return [...fromDevices, ...fromTrails];
  }, [devices, trails]);

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 });
  }, [map, points]);

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

export function PatrolLiveMap({
  devices,
  trails = [],
  showTrails = true,
}: {
  devices: MapDevice[];
  trails?: MapTrail[];
  showTrails?: boolean;
}) {
  const withCoords = devices.filter((d) => d.latitude != null && d.longitude != null);
  const visibleTrails = showTrails ? trails.filter((t) => t.points.length >= 2) : [];
  const allPoints = [
    ...withCoords.map((d) => [d.latitude!, d.longitude!] as [number, number]),
    ...visibleTrails.flatMap((t) => t.points),
  ];
  const center: [number, number] =
    allPoints.length > 0 ? allPoints[0] : [9.9281, -84.0909];

  return (
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
      <FitBounds devices={devices} trails={visibleTrails} />
      {visibleTrails.map((trail) => (
        <Polyline
          key={trail.deviceId}
          positions={trail.points}
          pathOptions={{
            color: trail.color,
            weight: 4,
            opacity: 0.75,
          }}
        />
      ))}
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
                <span style={{ color: STATUS_COLOR[d.status] }}>{STATUS_LABEL[d.status]}</span>
              </p>
              {d.recordedAt ? <p>Ultima posicion: {formatDateTime(d.recordedAt)}</p> : null}
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
  );
}

export function trailColorForIndex(index: number): string {
  return TRAIL_COLORS[index % TRAIL_COLORS.length];
}
