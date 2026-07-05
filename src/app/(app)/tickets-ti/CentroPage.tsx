"use client";

import { useQuery } from "@tanstack/react-query";
import { Headset } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission } from "@/lib/permissions/check";
import { useSession } from "next-auth/react";
import { TicketSearchBar } from "@/components/tickets-ti/TicketSearchBar";
import { TicketOperationCard } from "@/components/tickets-ti/TicketOperationCard";
import { TicketReportExportDialog } from "@/components/tickets-ti/TicketReportExportDialog";

type Reports = {
  total: number;
  closedThisMonth: number;
  avgWorkMinutes: number;
  slaBreached: number;
  byStatus: { code: string; name: string; count: number }[];
  byPriority: { code: string; name: string; count: number }[];
};

export default function TicketsTiCentroPage() {
  const { data: session } = useSession();
  const canExport = hasPermission(session, "ticketsTi.centro", "view");
  const canManage = hasPermission(session, "ticketsTi.centro", "edit");

  const { data, isLoading, error } = useQuery<{
    data: {
      counts: { active: number; waitingUser: number; overdueSla: number };
      tickets: Parameters<typeof TicketOperationCard>[0]["ticket"][];
    };
  }>({
    queryKey: ["tickets-ti-dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/tickets-ti/dashboard");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const { data: reportsData } = useQuery<{ data: Reports }>({
    queryKey: ["tickets-ti-reports"],
    queryFn: async () => {
      const r = await fetch("/api/tickets-ti/reports");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const dashboard = data?.data;
  const reports = reportsData?.data;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Headset className="h-7 w-7 text-red-600" />
            Centro de Operaciones
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cola de trabajo, indicadores y exportación de reportes.
          </p>
        </div>
        {canExport && <TicketReportExportDialog />}
      </div>

      <TicketSearchBar />

      {reports && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-slate-500">Total tickets</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{reports.total}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-slate-500">Cerrados este mes</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-emerald-700">{reports.closedThisMonth}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-slate-500">Prom. trabajo (min)</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{reports.avgWorkMinutes}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-slate-500">SLA incumplido</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-red-700">{reports.slaBreached}</CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por estado</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {reports.byStatus.map((row) => (
                    <li key={row.code} className="flex justify-between text-sm">
                      <span>{row.name}</span>
                      <span className="font-semibold tabular-nums">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por prioridad</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {reports.byPriority.map((row) => (
                    <li key={row.code} className="flex justify-between text-sm">
                      <span>{row.name}</span>
                      <span className="font-semibold tabular-nums">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {dashboard && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-slate-500">Activos</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{dashboard.counts.active}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-slate-500">Esperando usuario</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-amber-700">{dashboard.counts.waitingUser}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-slate-500">SLA vencido</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-red-700">{dashboard.counts.overdueSla}</CardContent>
          </Card>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Cola activa</h2>
        {isLoading && <p className="text-slate-500">Cargando tickets…</p>}
        {error && <p className="text-red-600">{(error as Error).message}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          {dashboard?.tickets.map((ticket) => (
            <TicketOperationCard key={ticket.id} ticket={ticket} canManage={canManage} />
          ))}
        </div>

        {dashboard?.tickets.length === 0 && !isLoading && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-slate-500">
              No hay tickets activos en la cola.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
