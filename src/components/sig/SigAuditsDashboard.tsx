"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CalendarPlus, CheckCircle2, Loader2 } from "lucide-react";
import type { QuarterProcedure } from "@/modules/sig";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DashboardData = {
  year: number;
  quarter: number;
  totalProcedures: number;
  assignedAudits: number;
  pendingProcedures: number;
  rows: QuarterProcedure[];
};

type ApiResponse<T> = { data: T; error?: { message: string } };

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CR", { dateStyle: "medium" }).format(new Date(value));
}

function currentQuarter() {
  const now = new Date();
  return { year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) + 1 };
}

function dateKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function quarterMonths(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  return [0, 1, 2].map((offset) => new Date(year, startMonth + offset, 1));
}

function checklistProgress(audit: NonNullable<QuarterProcedure["audit"]>) {
  const total = audit.checklistItems.length;
  const reviewed = audit.checklistItems.filter((item) => item.result !== "PENDING").length;
  return total > 0 ? `${reviewed}/${total}` : "0/0";
}

export function SigAuditsDashboard() {
  const initial = useMemo(() => currentQuarter(), []);
  const [year, setYear] = useState(initial.year);
  const [quarter, setQuarter] = useState(initial.quarter);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "calendar">("table");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sig/audits?year=${year}&quarter=${quarter}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<DashboardData>;
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudieron cargar las auditorías");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando auditorías");
    } finally {
      setLoading(false);
    }
  }, [quarter, year]);

  useEffect(() => {
    void load();
  }, [load]);

  async function assignAudit(procedureId: string) {
    const scheduledDate = dates[procedureId] || isoDate(new Date());
    setAssigningId(procedureId);
    setError(null);
    try {
      const res = await fetch("/api/sig/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureId, scheduledDate, year, quarter }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudo asignar la auditoría");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error asignando auditoría");
    } finally {
      setAssigningId(null);
    }
  }

  const auditsByDate = useMemo(() => {
    const map = new Map<string, QuarterProcedure[]>();
    for (const row of data?.rows ?? []) {
      if (!row.audit) continue;
      const key = dateKey(row.audit.scheduledDate);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return map;
  }, [data?.rows]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Auditorías trimestrales SIG</h1>
          <p className="text-sm text-slate-500">
            Cada procedimiento activo debe tener una auditoría asignada por trimestre.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-28"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                Trimestre {q}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Actualizar"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Procedimientos</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data?.totalProcedures ?? "-"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Con auditoría</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-green-700">{data?.assignedAudits ?? "-"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Pendientes</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-amber-700">{data?.pendingProcedures ?? "-"}</CardContent>
        </Card>
      </div>

      <div className="flex w-fit rounded-lg border bg-white p-1">
        <Button
          type="button"
          size="sm"
          variant={view === "table" ? "default" : "ghost"}
          onClick={() => setView("table")}
        >
          Tabla
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === "calendar" ? "default" : "ghost"}
          onClick={() => setView("calendar")}
        >
          <CalendarDays className="h-4 w-4" />
          Calendario
        </Button>
      </div>

      {view === "calendar" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {quarterMonths(year, quarter).map((month) => {
            const monthName = new Intl.DateTimeFormat("es-CR", { month: "long", year: "numeric" }).format(month);
            const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
            const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
            const leadingBlanks = (firstDay + 6) % 7;
            const cells = [
              ...Array.from({ length: leadingBlanks }, (_, index) => ({ key: `blank-${index}`, day: null as number | null })),
              ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
            ];

            return (
              <Card key={month.toISOString()}>
                <CardHeader className="pb-3">
                  <CardTitle className="capitalize">{monthName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
                    {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
                      <div key={`${day}-${index}`} className="py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {cells.map((cell) => {
                      if (!cell.day) return <div key={cell.key} className="min-h-24 rounded-md bg-slate-50" />;
                      const key = dateKey(new Date(month.getFullYear(), month.getMonth(), cell.day));
                      const rows = auditsByDate.get(key) ?? [];
                      return (
                        <div key={cell.key} className="min-h-24 rounded-md border bg-white p-1.5">
                          <div className="mb-1 text-xs font-semibold text-slate-500">{cell.day}</div>
                          <div className="space-y-1">
                            {rows.map((row) => (
                              <Link
                                key={row.audit!.id}
                                href={`/audits/${row.audit!.id}`}
                                className="block rounded bg-red-50 px-1.5 py-1 text-[11px] leading-tight text-red-800 hover:bg-red-100"
                              >
                                <span className="font-semibold">{row.code}</span>
                                <span className="block truncate">{row.title}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[68vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Procedimiento</th>
                  <th className="px-4 py-3">Proceso</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Auditoría</th>
                  <th className="px-4 py-3">Checklist</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Cargando procedimientos...
                    </td>
                  </tr>
                )}
                {!loading &&
                  data?.rows.map((row) => {
                    const missing = !row.audit;
                    return (
                      <tr key={row.id} className={missing ? "border-t bg-amber-50/70" : "border-t bg-white"}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{row.code}</div>
                          <div className="text-slate-500">{row.title}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.process?.name ?? "Sin proceso"}</td>
                        <td className="px-4 py-3">
                          {missing ? (
                            <Badge variant="warning" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Sin auditoría
                            </Badge>
                          ) : (
                            <Badge variant="success" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Asignada
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.audit ? (
                            <div>
                              <div>{formatDate(row.audit.scheduledDate)}</div>
                              <div className="text-xs text-slate-400">{row.audit.status}</div>
                            </div>
                          ) : (
                            <Input
                              type="date"
                              className="w-40 bg-white"
                              value={dates[row.id] ?? isoDate(new Date())}
                              onChange={(e) => setDates((prev) => ({ ...prev, [row.id]: e.target.value }))}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.audit ? checklistProgress(row.audit) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.audit ? (
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/audits/${row.audit.id}`}>Ver detalle</Link>
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => void assignAudit(row.id)} disabled={assigningId === row.id}>
                              {assigningId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CalendarPlus className="h-4 w-4" />
                              )}
                              Asignar
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                {!loading && data?.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      No hay procedimientos SIG activos para auditar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
