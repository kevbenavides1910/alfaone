"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  MapPinned,
  Smartphone,
  Route,
  MapPin,
  CalendarCheck,
  Settings2,
  Radio,
  FileBarChart,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/shared/MetricCard";
import { RecorridosPageHeader } from "@/components/recorridos/RecorridosPageHeader";
import { formatDateTime } from "@/lib/utils/format";

type SummaryResponse = {
  data: {
    totals: {
      devicesTotal: number;
      devicesActive: number;
      routesTotal: number;
      routesActive: number;
      pointsTotal: number;
      assignmentsToday: number;
    };
    recentDevices: {
      id: string;
      imei: string;
      employeeCode: string;
      label: string | null;
      isActive: boolean;
      lastLoginAt: string | null;
    }[];
    marksNote: string;
  };
  error?: { message: string };
};

const QUICK_LINKS = [
  { href: "/recorridos/mapa", label: "Mapa en vivo", icon: Radio, desc: "GPS y recorridos" },
  { href: "/recorridos/reportes", label: "Reportes de marcas", icon: FileBarChart, desc: "Cumplimiento NFC" },
  { href: "/recorridos/rutas", label: "Rutas y puntos", icon: MapPin, desc: "Ventanas horarias" },
  { href: "/recorridos/rutas-permitidas", label: "Asignaciones", icon: CalendarCheck, desc: "Rutas del día" },
  { href: "/recorridos/configuracion", label: "Configuración app", icon: Settings2, desc: "Parámetros de la app móvil" },
  { href: "/inventory", label: "Dispositivos", icon: Smartphone, desc: "Inventario celulares" },
] as const;

export default function RecorridosDashboardPage() {
  const { data, isLoading, isError, error } = useQuery<SummaryResponse>({
    queryKey: ["patrol-summary"],
    queryFn: async () => {
      const r = await fetch("/api/admin/patrol/reports/summary");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar resumen");
      return json;
    },
  });

  const totals = data?.data.totals;
  const recentDevices = data?.data.recentDevices ?? [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
      <RecorridosPageHeader
        title="Panel operativo"
        description="Supervise dispositivos móviles, rutas NFC, asignaciones diarias y cumplimiento de marcas."
      />

      {isError ? (
        <Card>
          <CardContent className="p-12 text-center text-red-600">
            {(error as Error)?.message ?? "No se pudo cargar el resumen."}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Dispositivos activos"
              value={isLoading ? "…" : String(totals?.devicesActive ?? 0)}
              subtitle={`de ${totals?.devicesTotal ?? 0} registrados`}
              icon={Smartphone}
              color="blue"
            />
            <MetricCard
              title="Rutas activas"
              value={isLoading ? "…" : String(totals?.routesActive ?? 0)}
              subtitle={`${totals?.pointsTotal ?? 0} puntos NFC configurados`}
              icon={Route}
              color="purple"
            />
            <MetricCard
              title="Asignaciones hoy"
              value={isLoading ? "…" : String(totals?.assignmentsToday ?? 0)}
              subtitle="Rutas vigentes para dispositivos"
              icon={CalendarCheck}
              color="green"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Accesos rápidos</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {QUICK_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-3 hover:bg-muted/60 hover:border-slate-300 transition-colors"
                  >
                    <div className="rounded-lg bg-red-50 p-2 text-red-600">
                      <link.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{link.label}</p>
                      <p className="text-xs text-slate-500 truncate">{link.desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-red-600 shrink-0" />
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-red-600" />
                  Últimos accesos móviles
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-slate-400 text-sm">Cargando accesos…</div>
                ) : recentDevices.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Aún no hay accesos registrados desde la app.
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {recentDevices.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/30"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-800">{d.employeeCode}</span>
                            <Badge variant={d.isActive ? "success" : "secondary"}>
                              {d.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{d.imei}</p>
                          {d.label ? (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{d.label}</p>
                          ) : null}
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                          {d.lastLoginAt ? formatDateTime(d.lastLoginAt) : "Sin login"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {data?.data.marksNote ? (
            <p className="text-xs text-slate-500 border-t border-border pt-4">{data.data.marksNote}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
