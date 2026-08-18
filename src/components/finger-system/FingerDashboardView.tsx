"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FingerDashboardStats } from "@/modules/finger-system/services/finger-dashboard";

type StatCardProps = {
  title: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
};

function StatCard({ title, value, hint, tone = "default" }: StatCardProps) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-red-700"
          : "text-slate-900";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function attStatusBadge(stats: FingerDashboardStats) {
  if (stats.att2016.reachable) {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Conectado</Badge>;
  }
  if (stats.att2016.configured) {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Configurado</Badge>;
  }
  return <Badge variant="secondary">Sin configurar</Badge>;
}

export function FingerDashboardView({ stats }: { stats: FingerDashboardStats }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-slate-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Dashboard Planillas</h1>
            <p className="mt-1 text-sm text-slate-600">
              Control central de asistencia biométrica. Integración ATT2016 en modo lectura.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {attStatusBadge(stats)}
            {stats.settings.attReadOnly ? (
              <Badge variant="outline">Solo lectura ATT2016</Badge>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">{stats.att2016.message}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Empleados activos" value={stats.employeesActive} />
        <StatCard title="Empleados vinculados" value={stats.employeesLinked} hint="Enlace Alfa One ↔ biométrico" />
        <StatCard title="Presentes hoy" value={stats.employeesPresentToday} hint="Disponible tras sync de marcas" />
        <StatCard title="Ausentes hoy" value={stats.employeesAbsentToday} />
        <StatCard title="Llegadas tardías" value={stats.lateArrivalsToday} tone="warning" />
        <StatCard title="Horas extra" value={stats.overtimeToday} />
        <StatCard title="Dispositivos online" value={stats.devicesOnline} tone="success" />
        <StatCard title="Dispositivos offline" value={stats.devicesOffline} tone="danger" />
        <StatCard title="Marcas del día" value={stats.punchesToday} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado de integración</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <p>
            <span className="font-medium text-slate-800">Share ATT2016:</span>{" "}
            {stats.settings.attSmbShare ?? "—"} / {stats.settings.attDatabaseName ?? "ATT2016"}
          </p>
          <p>
            <span className="font-medium text-slate-800">Última sincronización:</span>{" "}
            {stats.lastSyncAt
              ? new Date(stats.lastSyncAt).toLocaleString("es-CR")
              : "Sin sincronizaciones exitosas"}
          </p>
          <p>
            <span className="font-medium text-slate-800">Sync automática:</span>{" "}
            {stats.settings.syncAutoEnabled
              ? `Cada ${stats.settings.syncIntervalMinutes} min`
              : "Desactivada"}
          </p>
          <p>
            <span className="font-medium text-slate-800">Puerto descubrimiento:</span>{" "}
            {stats.settings.discoveryDefaultPort}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
