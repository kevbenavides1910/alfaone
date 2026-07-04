"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Radio, Route, Smartphone, Crosshair } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils/format";
import { RecorridosPageHeader } from "@/components/recorridos/RecorridosPageHeader";
import type { MapDevice, MapTrail } from "@/components/recorridos/PatrolLiveMap";

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

function trailColorForIndex(index: number): string {
  return TRAIL_COLORS[index % TRAIL_COLORS.length];
}

const PatrolLiveMap = dynamic(
  () => import("@/components/recorridos/PatrolLiveMap").then((m) => m.PatrolLiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] flex items-center justify-center bg-muted rounded-lg text-sm text-muted-foreground">
        Cargando mapa...
      </div>
    ),
  },
);

type LiveResponse = {
  data: {
    updatedAt: string;
    devices: MapDevice[];
  };
};

type HistoryResponse = {
  data: {
    desde: string;
    hasta: string;
    retentionDays: number;
    maxQueryDays?: number;
    requiresFilter?: boolean;
    trails: {
      deviceId: string;
      imei: string;
      label: string | null;
      employeeCode: string;
      points: { latitude: number; longitude: number; recordedAt: string }[];
      roadPaths?: { latitude: number; longitude: number }[][];
    }[];
  };
};

type RoutesResponse = {
  data: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  }[];
};

const STATUS_BADGE: Record<MapDevice["status"], string> = {
  online: "bg-green-100 text-green-800",
  stale: "bg-yellow-100 text-yellow-800",
  offline: "bg-gray-100 text-gray-700",
  no_signal: "bg-slate-100 text-slate-600",
};

const STATUS_LABEL: Record<MapDevice["status"], string> = {
  online: "En linea",
  stale: "Antigua",
  offline: "Offline",
  no_signal: "Sin GPS",
};

const SELECT_CLASS =
  "mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function todayStartLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T00:00`;
}

function nowLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function toIsoFromLocal(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export default function RecorridosMapaPage() {
  const [deviceId, setDeviceId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [historyDesde, setHistoryDesde] = useState(todayStartLocal());
  const [historyHasta, setHistoryHasta] = useState(nowLocal());
  const [showTrails, setShowTrails] = useState(true);
  const [trailStyle, setTrailStyle] = useState<"line" | "arrows">("line");
  const [followRoads, setFollowRoads] = useState(true);
  const [refitNonce, setRefitNonce] = useState(0);

  const mapFitKey = useMemo(
    () =>
      [
        deviceId,
        routeId,
        historyDesde,
        historyHasta,
        showTrails,
        trailStyle,
        followRoads,
        refitNonce,
      ].join("|"),
    [deviceId, routeId, historyDesde, historyHasta, showTrails, trailStyle, followRoads, refitNonce],
  );

  const liveQueryKey = useMemo(
    () => ["patrol-live-tracking", deviceId, routeId],
    [deviceId, routeId],
  );

  const historyQueryKey = useMemo(
    () => [
      "patrol-gps-history",
      deviceId,
      routeId,
      historyDesde,
      historyHasta,
      followRoads,
      trailStyle,
    ],
    [deviceId, routeId, historyDesde, historyHasta, followRoads, trailStyle],
  );

  const { data: routesData } = useQuery<RoutesResponse>({
    queryKey: ["patrol-routes-list"],
    queryFn: () => fetch("/api/admin/patrol/routes").then((r) => r.json()),
  });

  const { data, isLoading, isError, error, isFetching, refetch, dataUpdatedAt } = useQuery<LiveResponse>({
    queryKey: liveQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (deviceId) params.set("deviceId", deviceId);
      if (routeId) params.set("routeId", routeId);
      const q = params.toString();
      const r = await fetch(`/api/admin/patrol/tracking/live${q ? `?${q}` : ""}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar posiciones");
      return json;
    },
    refetchInterval: 30_000,
  });

  const historyEnabled = showTrails && Boolean(deviceId || routeId);

  const {
    data: historyData,
    isLoading: loadingHistory,
    refetch: refetchHistory,
    isFetching: fetchingHistory,
  } = useQuery<HistoryResponse>({
    queryKey: historyQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        desde: toIsoFromLocal(historyDesde),
        hasta: toIsoFromLocal(historyHasta),
      });
      if (deviceId) params.set("deviceId", deviceId);
      if (routeId) params.set("routeId", routeId);
      if (!followRoads || trailStyle === "arrows") params.set("snapRoads", "0");
      const r = await fetch(`/api/admin/patrol/tracking/history?${params}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar recorrido");
      return json;
    },
    enabled: historyEnabled,
  });

  const allDevices = data?.data?.devices ?? [];
  const routes = Array.isArray(routesData?.data) ? routesData.data.filter((r) => r.isActive) : [];

  const filteredSidebarDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();
    if (!q) return allDevices;
    return allDevices.filter(
      (d) =>
        d.imei.toLowerCase().includes(q) ||
        d.employeeCode.toLowerCase().includes(q) ||
        (d.label ?? "").toLowerCase().includes(q),
    );
  }, [allDevices, deviceSearch]);

  const trails: MapTrail[] = useMemo(() => {
    if (!showTrails || !historyData?.data?.trails) return [];
    return historyData.data.trails.map((t, i) => ({
      deviceId: t.deviceId,
      label: t.label,
      employeeCode: t.employeeCode,
      color: trailColorForIndex(i),
      trailPoints: t.points.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        recordedAt: p.recordedAt,
      })),
      pointCount: t.points.length,
      roadPaths: t.roadPaths,
    }));
  }, [historyData, showTrails]);

  const totalHistoryPoints = trails.reduce((n, t) => n + t.pointCount, 0);
  const withGps = allDevices.filter((d) => d.latitude != null && d.longitude != null);
  const online = allDevices.filter((d) => d.status === "online").length;

  function clearFilters() {
    setDeviceId("");
    setRouteId("");
    setDeviceSearch("");
    setHistoryDesde(todayStartLocal());
    setHistoryHasta(nowLocal());
  }

  function refreshAll() {
    refetch();
    if (historyEnabled) refetchHistory();
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto w-full">
      <RecorridosPageHeader
        icon={Radio}
        title="Mapa en vivo"
        description="Posición actual (actualización cada 30 s) y recorrido GPS por dispositivo o ruta (hasta 30 días)."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefitNonce((n) => n + 1)}
              disabled={isLoading}
            >
              <Crosshair className="h-4 w-4 mr-2" />
              Centrar mapa
            </Button>
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={isFetching || fetchingHistory}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching || fetchingHistory ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Smartphone className="h-3 w-3" /> Dispositivo
              </label>
              <select
                className={SELECT_CLASS}
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                <option value="">Seleccione dispositivo...</option>
                {allDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label ?? d.employeeCode} · {d.imei}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Route className="h-3 w-3" /> Ruta
              </label>
              <select
                className={SELECT_CLASS}
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
              >
                <option value="">Seleccione ruta...</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} · {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Recorrido desde</label>
              <Input
                type="datetime-local"
                value={historyDesde}
                onChange={(e) => setHistoryDesde(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Recorrido hasta</label>
              <Input
                type="datetime-local"
                value={historyHasta}
                onChange={(e) => setHistoryHasta(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showTrails}
                onChange={(e) => setShowTrails(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
              Mostrar recorrido historico
            </label>
            <div className="flex items-center gap-2">
              <label htmlFor="trail-style" className="text-sm text-muted-foreground shrink-0">
                Vista del recorrido
              </label>
              <select
                id="trail-style"
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={trailStyle}
                onChange={(e) => setTrailStyle(e.target.value as "line" | "arrows")}
                disabled={!showTrails}
              >
                <option value="line">Linea continua + flechas</option>
                <option value="arrows">Solo flechas (direccion)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={followRoads}
                onChange={(e) => setFollowRoads(e.target.checked)}
                disabled={!showTrails || trailStyle === "arrows"}
                className="h-4 w-4 rounded border"
              />
              Seguir calles (OpenStreetMap)
            </label>
            {(deviceId || routeId) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              El sistema conserva puntos GPS hasta <strong>2 meses</strong> por dispositivo.
              {showTrails && !deviceId && !routeId ? (
                <> · Seleccione un dispositivo o ruta para cargar el recorrido.</>
              ) : null}
              {historyEnabled && (loadingHistory || fetchingHistory) && trailStyle === "line" && followRoads ? (
                <> · Ajustando recorrido a calles…</>
              ) : null}
              {historyEnabled && !loadingHistory ? (
                <> · {totalHistoryPoints} puntos en el periodo (max. 5000 por recorrido)</>
              ) : null}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="h-[min(70vh,560px)]">
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Cargando dispositivos...
                </div>
              ) : isError ? (
                <div className="h-full flex items-center justify-center text-red-600 px-6 text-center text-sm">
                  {(error as Error)?.message ?? "No se pudieron cargar las posiciones GPS."}
                </div>
              ) : (
                <PatrolLiveMap
                  devices={allDevices}
                  trails={trails}
                  showTrails={showTrails}
                  showTrailLines={trailStyle === "line"}
                  fitKey={mapFitKey}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>
                En linea: <strong>{online}</strong> / {allDevices.length}
              </p>
              <p>
                Con coordenadas: <strong>{withGps.length}</strong>
              </p>
              {showTrails ? (
                <p>
                  Recorridos visibles: <strong>{trails.length}</strong>
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Ultima consulta:{" "}
                {dataUpdatedAt ? formatDateTime(new Date(dataUpdatedAt).toISOString()) : "—"}
              </p>
            </CardContent>
          </Card>

          {showTrails && trails.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Leyenda recorridos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[160px] overflow-y-auto">
                {trails.map((t) => (
                  <div key={t.deviceId} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-3 w-8 rounded shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="truncate">
                      {t.label ?? t.employeeCode} ({t.pointCount} pts)
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Dispositivos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="Buscar IMEI, codigo o nombre..."
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="max-h-[320px] overflow-y-auto space-y-2">
                {filteredSidebarDevices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {allDevices.length === 0
                      ? "No hay dispositivos con los filtros actuales."
                      : "Sin coincidencias en la busqueda."}
                  </p>
                ) : (
                  filteredSidebarDevices.map((d) => (
                    <button
                      key={d.deviceId}
                      type="button"
                      onClick={() => setDeviceId(d.deviceId === deviceId ? "" : d.deviceId)}
                      className={`w-full rounded-md border px-3 py-2 text-sm space-y-1 text-left transition-colors ${
                        deviceId === d.deviceId ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{d.label ?? d.employeeCode}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[d.status]}`}
                        >
                          {STATUS_LABEL[d.status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">IMEI {d.imei}</p>
                      {d.recordedAt ? (
                        <p className="text-xs">{formatDateTime(d.recordedAt)}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sin ubicacion reportada</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="pt-4 text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Linea continua:</strong> une los puntos GPS (opcionalmente por calles con OSRM).
              </p>
              <p>
                <strong>Solo flechas:</strong> direccion del movimiento entre puntos; pase el cursor para
                ver la hora. Sin linea de union.
              </p>
              <p>Verde/amarillo/gris: ultima posicion en vivo (2 min / 10 min).</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
