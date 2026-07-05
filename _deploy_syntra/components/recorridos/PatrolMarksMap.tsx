"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatDateTime } from "@/lib/utils/format";

export type ReportMarkPoint = {
  id: string;
  label: string;
  routeName: string;
  pointLabel: string;
  nfcTagCode: string;
  estado: "REALIZADA" | "NO_REALIZADA";
  markedAt: string | null;
  latitude: number;
  longitude: number;
};

const COLOR = {
  REALIZADA: "#16a34a",
  NO_REALIZADA: "#dc2626",
} as const;

function FitMarks({ marks }: { marks: ReportMarkPoint[] }) {
  const map = useMap();
  const points = useMemo(
    () => marks.map((m) => [m.latitude, m.longitude] as [number, number]),
    [marks],
  );

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 17 });
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

export function PatrolMarksMap({ marks }: { marks: ReportMarkPoint[] }) {
  const center: [number, number] =
    marks.length > 0 ? [marks[0].latitude, marks[0].longitude] : [9.9281, -84.0909];

  if (marks.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
        No hay marcas con coordenadas GPS en el periodo filtrado.
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom
      className="h-[420px] w-full rounded-lg z-0"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      <MapResizeFix />
      <FitMarks marks={marks} />
      {marks.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.latitude, m.longitude]}
          radius={9}
          pathOptions={{
            color: COLOR[m.estado],
            fillColor: COLOR[m.estado],
            fillOpacity: 0.85,
            weight: 2,
          }}
        >
          <Popup>
            <div className="text-sm space-y-1 min-w-[200px]">
              <p className="font-semibold">{m.pointLabel}</p>
              <p>{m.routeName}</p>
              <p>Tag: {m.nfcTagCode}</p>
              <p>
                Estado:{" "}
                <span style={{ color: COLOR[m.estado] }}>
                  {m.estado === "REALIZADA" ? "Realizada" : "No realizada"}
                </span>
              </p>
              {m.markedAt ? <p>Hora: {formatDateTime(m.markedAt)}</p> : null}
              <p className="text-xs text-muted-foreground">
                {m.latitude.toFixed(6)}, {m.longitude.toFixed(6)}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
