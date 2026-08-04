"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TrafficLight = "GREEN" | "YELLOW" | "RED" | "GRAY";

type IndicatorRow = {
  id: string;
  code: string;
  title: string;
  unit: string | null;
  direction: string;
  frequency: string;
  targetValue: string | number | null;
  latestValue: number | null;
  trafficLight: TrafficLight;
  measurementOverdue: boolean;
  status: string;
  process: { id: string; code: string; name: string } | null;
  _count: { measurements: number };
};

const LIGHT_STYLE: Record<TrafficLight, string> = {
  GREEN: "bg-emerald-100 text-emerald-800",
  YELLOW: "bg-amber-100 text-amber-800",
  RED: "bg-red-100 text-red-800",
  GRAY: "bg-slate-100 text-slate-600",
};

export default function SigIndicadoresPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [processId, setProcessId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    processId: "",
    unit: "%",
    direction: "HIGHER_BETTER",
    frequency: "MONTHLY",
    targetValue: "",
    warningThreshold: "",
    criticalThreshold: "",
    description: "",
  });

  const { data: processes = [] } = useQuery({
    queryKey: ["sig-procesos-filter"],
    queryFn: async () => {
      const r = await fetch("/api/sig/procesos", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error procesos");
      const json = await r.json();
      return json.data as Array<{ id: string; code: string; name: string }>;
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sig-indicators", q, processId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (processId) params.set("processId", processId);
      const r = await fetch(`/api/sig/indicators?${params}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error cargando indicadores");
      const json = await r.json();
      return json.data as IndicatorRow[];
    },
  });

  const summary = useMemo(
    () => ({
      total: rows.length,
      red: rows.filter((r) => r.trafficLight === "RED").length,
      yellow: rows.filter((r) => r.trafficLight === "YELLOW").length,
      green: rows.filter((r) => r.trafficLight === "GREEN").length,
    }),
    [rows]
  );

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/sig/indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          processId: form.processId || null,
          processIds: form.processId ? [form.processId] : [],
          unit: form.unit || null,
          direction: form.direction,
          frequency: form.frequency,
          targetValue: form.targetValue ? Number(form.targetValue) : null,
          warningThreshold: form.warningThreshold ? Number(form.warningThreshold) : null,
          criticalThreshold: form.criticalThreshold ? Number(form.criticalThreshold) : null,
          description: form.description || null,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo crear");
      setForm({
        title: "",
        processId: "",
        unit: "%",
        direction: "HIGHER_BETTER",
        frequency: "MONTHLY",
        targetValue: "",
        warningThreshold: "",
        criticalThreshold: "",
        description: "",
      });
      await qc.invalidateQueries({ queryKey: ["sig-indicators"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando indicador");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="Indicadores SIG" />
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ISO 9001 · 9.1</p>
          <h1 className="text-2xl font-semibold text-slate-900">Indicadores de desempeño</h1>
          <p className="text-sm text-slate-500">
            KPI por proceso con meta, umbrales y mediciones periódicas. Semáforo según dirección (mayor/menor es mejor).
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Total</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{summary.total}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Rojo</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-red-700">{summary.red}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Amarillo</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-amber-700">{summary.yellow}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Verde</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-emerald-700">{summary.green}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo indicador</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
              <div className="space-y-1 md:col-span-2">
                <Label>Título</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Proceso</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.processId}
                  onChange={(e) => setForm((f) => ({ ...f, processId: e.target.value }))}
                >
                  <option value="">Sin proceso</option>
                  {processes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Unidad</Label>
                <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Dirección</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.direction}
                  onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
                >
                  <option value="HIGHER_BETTER">Mayor es mejor</option>
                  <option value="LOWER_BETTER">Menor es mejor</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Frecuencia</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                >
                  <option value="WEEKLY">Semanal</option>
                  <option value="MONTHLY">Mensual</option>
                  <option value="QUARTERLY">Trimestral</option>
                  <option value="ANNUAL">Anual</option>
                  <option value="ADHOC">Ad hoc</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Meta</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.targetValue}
                  onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Umbral alerta</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.warningThreshold}
                  onChange={(e) => setForm((f) => ({ ...f, warningThreshold: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Umbral crítico</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.criticalThreshold}
                  onChange={(e) => setForm((f) => ({ ...f, criticalThreshold: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Descripción</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving || !form.title.trim()}>
                  {saving ? "Guardando..." : "Crear indicador"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={processId}
            onChange={(e) => setProcessId(e.target.value)}
          >
            <option value="">Todos los procesos</option>
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tablero</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <p className="text-sm text-slate-500">Cargando...</p>
            ) : (
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Código</th>
                    <th className="px-2 py-2">Indicador</th>
                    <th className="px-2 py-2">Proceso</th>
                    <th className="px-2 py-2">Último</th>
                    <th className="px-2 py-2">Meta</th>
                    <th className="px-2 py-2">Semáforo</th>
                    <th className="px-2 py-2">Mediciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b align-top">
                      <td className="px-2 py-2">
                        <Link
                          href={`/sig/indicadores/${row.id}`}
                          className="font-medium text-red-700 hover:underline"
                        >
                          {row.code}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        {row.title}
                        {row.measurementOverdue && (
                          <span className="ml-2 text-xs text-amber-700">Medición vencida</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs">{row.process?.code ?? "—"}</td>
                      <td className="px-2 py-2">
                        {row.latestValue != null ? `${row.latestValue}${row.unit ? ` ${row.unit}` : ""}` : "—"}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {row.targetValue != null ? `${row.targetValue}${row.unit ? ` ${row.unit}` : ""}` : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ${LIGHT_STYLE[row.trafficLight]}`}>
                          {row.trafficLight}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-500">{row._count.measurements}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-2 py-6 text-center text-slate-500">
                        Sin indicadores
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
