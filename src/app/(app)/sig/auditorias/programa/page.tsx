"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Loader2, RefreshCw } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProgramItem = {
  id: string;
  plannedMonth: number;
  plannedQuarter: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priorityScore: number;
  priorityReason: string | null;
  status: string;
  objective: string | null;
  process: { id: string; code: string; name: string } | null;
  procedure: { id: string; code: string; title: string } | null;
  linkedAudit: {
    id: string;
    year: number;
    quarter: number;
    status: string;
    scheduledDate: string;
  } | null;
};

type Program = {
  id: string;
  year: number;
  title: string;
  status: "DRAFT" | "APPROVED" | "IN_PROGRESS" | "CLOSED";
  notes: string | null;
  approvedAt: string | null;
  items: ProgramItem[];
};

const MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const PRIORITY_STYLE: Record<ProgramItem["priority"], string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-slate-100 text-slate-700",
};

const STATUS_LABEL: Record<Program["status"], string> = {
  DRAFT: "Borrador",
  APPROVED: "Aprobado",
  IN_PROGRESS: "En ejecución",
  CLOSED: "Cerrado",
};

export default function SigAuditProgramPage() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState("");

  const { data: program, isLoading, refetch } = useQuery({
    queryKey: ["sig-audit-program", year],
    queryFn: async () => {
      const r = await fetch(`/api/sig/audit-programs?year=${year}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error cargando programa anual");
      const json = await r.json();
      return (json.data as Program | null) ?? null;
    },
  });

  const matrix = useMemo(() => {
    const cells: Record<number, ProgramItem[]> = {};
    for (let m = 1; m <= 12; m++) cells[m] = [];
    for (const item of program?.items ?? []) {
      cells[item.plannedMonth]?.push(item);
    }
    return cells;
  }, [program?.items]);

  const summary = useMemo(() => {
    const items = program?.items ?? [];
    return {
      total: items.length,
      critical: items.filter((i) => i.priority === "CRITICAL" || i.priority === "HIGH").length,
      scheduled: items.filter((i) => i.linkedAudit).length,
      pending: items.filter((i) => !i.linkedAudit && i.status !== "CANCELLED").length,
    };
  }, [program?.items]);

  async function createProgram(e: FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    try {
      const r = await fetch("/api/sig/audit-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          title: createTitle || undefined,
          seedFromProcedures: true,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo crear el programa");
      setCreateTitle("");
      await qc.invalidateQueries({ queryKey: ["sig-audit-program", year] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando programa");
    } finally {
      setBusy(null);
    }
  }

  async function patchProgram(action: string, body: Record<string, unknown> = {}) {
    if (!program) return;
    setBusy(action);
    setError(null);
    try {
      const r = await fetch(`/api/sig/audit-programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo actualizar");
      await qc.invalidateQueries({ queryKey: ["sig-audit-program", year] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando programa");
    } finally {
      setBusy(null);
    }
  }

  async function moveItem(itemId: string, plannedMonth: number) {
    setBusy(`move-${itemId}`);
    setError(null);
    try {
      const r = await fetch(`/api/sig/audit-programs/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedMonth }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo mover el ítem");
      await qc.invalidateQueries({ queryKey: ["sig-audit-program", year] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error moviendo ítem");
    } finally {
      setBusy(null);
    }
  }

  async function createAudit(itemId: string) {
    setBusy(`audit-${itemId}`);
    setError(null);
    try {
      const r = await fetch(`/api/sig/audit-programs/items/${itemId}/create-audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo crear la auditoría");
      await qc.invalidateQueries({ queryKey: ["sig-audit-program", year] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando auditoría");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="Programa anual de auditorías" />
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">F-SIG-21</p>
            <h1 className="text-2xl font-semibold text-slate-900">Programa anual de auditorías internas</h1>
            <p className="text-sm text-slate-500">
              Priorización por NC abiertas, tiempo sin auditar, acciones vencidas y controles vencidos (ISO 19011 /
              Manual 9.2).
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
            <Button variant="outline" asChild>
              <Link href="/sig/auditorias">Vista trimestral</Link>
            </Button>
            <Button variant="outline" onClick={() => void refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Actualizar
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {!program && !isLoading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Crear programa {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={createProgram}>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="title">Título (opcional)</Label>
                  <Input
                    id="title"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder={`Programa anual de auditorías internas ${year}`}
                  />
                </div>
                <Button type="submit" disabled={busy === "create"}>
                  {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />}
                  Generar desde procedimientos
                </Button>
              </form>
              <p className="mt-2 text-xs text-slate-500">
                Se creará un ítem por procedimiento activo, con mes sugerido según prioridad.
              </p>
            </CardContent>
          </Card>
        )}

        {program && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{STATUS_LABEL[program.status]}</Badge>
              <span className="text-sm text-slate-600">{program.title}</span>
              {program.status === "DRAFT" && (
                <Button size="sm" onClick={() => void patchProgram("approve")} disabled={busy === "approve"}>
                  {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Aprobar programa
                </Button>
              )}
              {program.status !== "CLOSED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void patchProgram("refreshPriorities")}
                  disabled={busy === "refreshPriorities"}
                >
                  {busy === "refreshPriorities" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Recalcular prioridades
                </Button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-500">Ítems</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">{summary.total}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-500">Alta prioridad</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold text-orange-700">{summary.critical}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-500">Con auditoría</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold text-green-700">{summary.scheduled}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-500">Pendientes</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold text-amber-700">{summary.pending}</CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Matriz anual (mes × procedimientos)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="grid min-w-[1100px] grid-cols-12 gap-2">
                  {MONTHS.map((label, idx) => {
                    const month = idx + 1;
                    const items = matrix[month] ?? [];
                    return (
                      <div key={label} className="rounded-md border bg-white p-2">
                        <div className="mb-2 text-center text-xs font-semibold text-slate-600">
                          {label}
                          <span className="block font-normal text-slate-400">T{Math.floor(idx / 3) + 1}</span>
                        </div>
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                              <div className="font-medium text-slate-800">
                                {item.procedure?.code ?? item.process?.code ?? "—"}
                              </div>
                              <div className="line-clamp-2 text-slate-500">
                                {item.procedure?.title ?? item.process?.name ?? "Sin título"}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className={`rounded px-1.5 py-0.5 ${PRIORITY_STYLE[item.priority]}`}>
                                  {item.priority} ({item.priorityScore})
                                </span>
                              </div>
                              {item.priorityReason && (
                                <p className="mt-1 line-clamp-3 text-[10px] text-slate-500">{item.priorityReason}</p>
                              )}
                              <div className="mt-2 space-y-1">
                                <select
                                  className="h-7 w-full rounded border bg-white px-1 text-[11px]"
                                  value={item.plannedMonth}
                                  disabled={program.status === "CLOSED" || busy === `move-${item.id}`}
                                  onChange={(e) => void moveItem(item.id, Number(e.target.value))}
                                >
                                  {MONTHS.map((m, i) => (
                                    <option key={m} value={i + 1}>
                                      Mover a {m}
                                    </option>
                                  ))}
                                </select>
                                {item.linkedAudit ? (
                                  <Button asChild size="sm" variant="outline" className="h-7 w-full text-[11px]">
                                    <Link href={`/audits/${item.linkedAudit.id}`}>Ver auditoría</Link>
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="h-7 w-full text-[11px]"
                                    disabled={!item.procedure || busy === `audit-${item.id}`}
                                    onClick={() => void createAudit(item.id)}
                                  >
                                    {busy === `audit-${item.id}` ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "Crear auditoría"
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                          {!items.length && (
                            <p className="py-4 text-center text-[10px] text-slate-400">Sin ítems</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Listado por prioridad</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="border-b text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-2">Prioridad</th>
                      <th className="px-2 py-2">Procedimiento</th>
                      <th className="px-2 py-2">Proceso</th>
                      <th className="px-2 py-2">Mes</th>
                      <th className="px-2 py-2">Estado</th>
                      <th className="px-2 py-2">Motivo</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...(program.items ?? [])]
                      .sort((a, b) => b.priorityScore - a.priorityScore)
                      .map((item) => (
                        <tr key={item.id} className="border-b align-top">
                          <td className="px-2 py-2">
                            <span className={`rounded px-1.5 py-0.5 text-xs ${PRIORITY_STYLE[item.priority]}`}>
                              {item.priority} ({item.priorityScore})
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="font-medium">{item.procedure?.code ?? "—"}</div>
                            <div className="text-xs text-slate-500">{item.procedure?.title}</div>
                          </td>
                          <td className="px-2 py-2 text-xs">
                            {item.process ? `${item.process.code} · ${item.process.name}` : "—"}
                          </td>
                          <td className="px-2 py-2">
                            {MONTHS[item.plannedMonth - 1]} (T{item.plannedQuarter})
                          </td>
                          <td className="px-2 py-2 text-xs">{item.status}</td>
                          <td className="max-w-xs px-2 py-2 text-xs text-slate-500">{item.priorityReason}</td>
                          <td className="px-2 py-2">
                            {item.linkedAudit ? (
                              <Link className="text-xs text-red-600 hover:underline" href={`/audits/${item.linkedAudit.id}`}>
                                Abrir
                              </Link>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
