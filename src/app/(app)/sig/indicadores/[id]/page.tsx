"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils/format";

type TrafficLight = "GREEN" | "YELLOW" | "RED" | "GRAY";

type Detail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  unit: string | null;
  direction: string;
  frequency: string;
  targetValue: string | number | null;
  warningThreshold: string | number | null;
  criticalThreshold: string | number | null;
  status: string;
  formulaNotes: string | null;
  trafficLight: TrafficLight;
  measurementOverdue: boolean;
  latestValue: number | null;
  process: { id: string; code: string; name: string } | null;
  measurements: Array<{
    id: string;
    value: string | number;
    periodStart: string;
    periodEnd: string | null;
    notes: string | null;
    recordedBy: { name: string | null; email: string };
    evidence: { id: string; code: string } | null;
  }>;
};

const LIGHT_STYLE: Record<TrafficLight, string> = {
  GREEN: "bg-emerald-100 text-emerald-800",
  YELLOW: "bg-amber-100 text-amber-800",
  RED: "bg-red-100 text-red-800",
  GRAY: "bg-slate-100 text-slate-600",
};

export default function SigIndicatorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState({
    targetValue: "",
    warningThreshold: "",
    criticalThreshold: "",
    status: "",
    formulaNotes: "",
  });
  const [measurement, setMeasurement] = useState({
    periodStart: new Date().toISOString().slice(0, 10),
    value: "",
    notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sig-indicator", id],
    queryFn: async () => {
      const r = await fetch(`/api/sig/indicators/${id}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Indicador no encontrado");
      const json = await r.json();
      return json.data as Detail;
    },
  });

  useEffect(() => {
    if (!data) return;
    setEdit({
      targetValue: data.targetValue != null ? String(data.targetValue) : "",
      warningThreshold: data.warningThreshold != null ? String(data.warningThreshold) : "",
      criticalThreshold: data.criticalThreshold != null ? String(data.criticalThreshold) : "",
      status: data.status,
      formulaNotes: data.formulaNotes ?? "",
    });
  }, [data]);

  async function onSaveMeta(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/sig/indicators/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetValue: edit.targetValue ? Number(edit.targetValue) : null,
          warningThreshold: edit.warningThreshold ? Number(edit.warningThreshold) : null,
          criticalThreshold: edit.criticalThreshold ? Number(edit.criticalThreshold) : null,
          status: edit.status,
          formulaNotes: edit.formulaNotes || null,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo guardar");
      await qc.invalidateQueries({ queryKey: ["sig-indicator", id] });
      await qc.invalidateQueries({ queryKey: ["sig-indicators"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function onAddMeasurement(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/sig/indicators/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart: measurement.periodStart,
          value: Number(measurement.value),
          notes: measurement.notes || null,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo registrar medición");
      setMeasurement((m) => ({ ...m, value: "", notes: "" }));
      await qc.invalidateQueries({ queryKey: ["sig-indicator", id] });
      await qc.invalidateQueries({ queryKey: ["sig-indicators"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteMeasurement(measurementId: string) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/sig/indicators/measurements/${measurementId}`, {
        method: "DELETE",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo eliminar");
      await qc.invalidateQueries({ queryKey: ["sig-indicator", id] });
      await qc.invalidateQueries({ queryKey: ["sig-indicators"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <Topbar title="Indicador SIG" />
        <div className="p-6 text-slate-500">{isLoading ? "Cargando..." : "No encontrado"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title={data.code} />
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <Link href="/sig/indicadores" className="text-sm text-red-600 hover:underline">
          Volver a indicadores
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>
              {data.code} — {data.title}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{data.frequency}</Badge>
              <Badge variant="outline">
                {data.direction === "LOWER_BETTER" ? "Menor es mejor" : "Mayor es mejor"}
              </Badge>
              <Badge variant="outline">{data.status}</Badge>
              <span className={`rounded px-2 py-0.5 text-xs ${LIGHT_STYLE[data.trafficLight]}`}>
                {data.trafficLight}
                {data.latestValue != null
                  ? ` · ${data.latestValue}${data.unit ? ` ${data.unit}` : ""}`
                  : ""}
              </span>
              {data.measurementOverdue && <Badge variant="danger">Medición vencida</Badge>}
              {data.process && (
                <Link href={`/sig/procesos/${data.process.id}`}>
                  <Badge variant="outline">
                    {data.process.code} — {data.process.name}
                  </Badge>
                </Link>
              )}
            </div>
            {data.description && <p className="text-sm text-slate-600">{data.description}</p>}
          </CardHeader>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metas y umbrales</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onSaveMeta}>
              <div className="space-y-1">
                <Label>Meta</Label>
                <Input
                  type="number"
                  step="any"
                  value={edit.targetValue}
                  onChange={(e) => setEdit((f) => ({ ...f, targetValue: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={edit.status}
                  onChange={(e) => setEdit((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Umbral alerta</Label>
                <Input
                  type="number"
                  step="any"
                  value={edit.warningThreshold}
                  onChange={(e) => setEdit((f) => ({ ...f, warningThreshold: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Umbral crítico</Label>
                <Input
                  type="number"
                  step="any"
                  value={edit.criticalThreshold}
                  onChange={(e) => setEdit((f) => ({ ...f, criticalThreshold: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Fórmula / notas</Label>
                <Textarea
                  rows={2}
                  value={edit.formulaNotes}
                  onChange={(e) => setEdit((f) => ({ ...f, formulaNotes: e.target.value }))}
                />
              </div>
              <div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar metas"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar medición</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={onAddMeasurement}>
              <div className="space-y-1">
                <Label>Periodo</Label>
                <Input
                  type="date"
                  required
                  value={measurement.periodStart}
                  onChange={(e) => setMeasurement((m) => ({ ...m, periodStart: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Valor{data.unit ? ` (${data.unit})` : ""}</Label>
                <Input
                  type="number"
                  step="any"
                  required
                  value={measurement.value}
                  onChange={(e) => setMeasurement((m) => ({ ...m, value: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label>Notas</Label>
                <Input
                  value={measurement.notes}
                  onChange={(e) => setMeasurement((m) => ({ ...m, notes: e.target.value }))}
                />
              </div>
              <div>
                <Button type="submit" disabled={saving || !measurement.value}>
                  Registrar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.measurements.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
                <div>
                  <span className="font-medium">
                    {Number(m.value)}
                    {data.unit ? ` ${data.unit}` : ""}
                  </span>{" "}
                  <span className="text-slate-500">
                    · {formatDate(m.periodStart)} · {m.recordedBy.name || m.recordedBy.email}
                  </span>
                  {m.notes && <p className="text-xs text-slate-500">{m.notes}</p>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void onDeleteMeasurement(m.id)}
                >
                  Eliminar
                </Button>
              </div>
            ))}
            {data.measurements.length === 0 && <p className="text-slate-500">Sin mediciones</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
