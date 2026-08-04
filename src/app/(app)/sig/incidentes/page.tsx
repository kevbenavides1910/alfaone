"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
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

type IncidentRow = {
  id: string;
  code: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  humanRightsImpact: boolean;
  occurredAt: string;
  location: string | null;
  trafficLight: TrafficLight;
  open: boolean;
  process: { id: string; code: string; name: string } | null;
  _count: { evidenceLinks: number; controlLinks: number };
};

const LIGHT_STYLE: Record<TrafficLight, string> = {
  GREEN: "bg-emerald-100 text-emerald-800",
  YELLOW: "bg-amber-100 text-amber-800",
  RED: "bg-red-100 text-red-800",
  GRAY: "bg-slate-100 text-slate-600",
};

const TYPE_LABEL: Record<string, string> = {
  SECURITY_EVENT: "Evento de seguridad",
  USE_OF_FORCE: "Uso de la fuerza",
  HUMAN_RIGHTS: "Derechos humanos",
  COMPLAINT: "Queja / reclamo",
  NEAR_MISS: "Casi-incidente",
  OTHER: "Otro",
};

export default function SigIncidentesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [processId, setProcessId] = useState("");
  const [type, setType] = useState("");
  const [onlyHr, setOnlyHr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "SECURITY_EVENT",
    severity: "MEDIUM",
    occurredAt: new Date().toISOString().slice(0, 16),
    location: "",
    processId: "",
    humanRightsImpact: false,
    immediateActions: "",
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
    queryKey: ["sig-incidents", q, processId, type, onlyHr],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (processId) params.set("processId", processId);
      if (type) params.set("type", type);
      if (onlyHr) params.set("humanRightsImpact", "1");
      const r = await fetch(`/api/sig/incidents?${params}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error cargando incidentes");
      const json = await r.json();
      return json.data as IncidentRow[];
    },
  });

  const summary = useMemo(
    () => ({
      total: rows.length,
      open: rows.filter((r) => r.open).length,
      hr: rows.filter((r) => r.humanRightsImpact).length,
      red: rows.filter((r) => r.trafficLight === "RED").length,
    }),
    [rows]
  );

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/sig/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          type: form.type,
          severity: form.severity,
          occurredAt: new Date(form.occurredAt).toISOString(),
          location: form.location || null,
          processId: form.processId || null,
          processIds: form.processId ? [form.processId] : [],
          humanRightsImpact: form.humanRightsImpact || form.type === "HUMAN_RIGHTS",
          immediateActions: form.immediateActions || null,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo crear");
      setForm({
        title: "",
        description: "",
        type: "SECURITY_EVENT",
        severity: "MEDIUM",
        occurredAt: new Date().toISOString().slice(0, 16),
        location: "",
        processId: "",
        humanRightsImpact: false,
        immediateActions: "",
      });
      await qc.invalidateQueries({ queryKey: ["sig-incidents"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando incidente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="Incidentes SIG · ISO 18788" />
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ISO 18788</p>
          <h1 className="text-2xl font-semibold text-slate-900">Incidentes, uso de la fuerza y DDHH</h1>
          <p className="text-sm text-slate-500">
            Registro, investigación y cierre de eventos de seguridad privada con trazabilidad de evidencias.
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
              <CardTitle className="text-sm text-slate-500">Abiertos</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-amber-700">{summary.open}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">DDHH / críticos</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-red-700">{summary.red}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Impacto DDHH</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{summary.hr}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reportar incidente</CardTitle>
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
                <Label>Tipo</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value,
                      humanRightsImpact:
                        e.target.value === "HUMAN_RIGHTS" || e.target.value === "USE_OF_FORCE"
                          ? true
                          : f.humanRightsImpact,
                    }))
                  }
                >
                  {Object.entries(TYPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Severidad</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Fecha/hora</Label>
                <Input
                  type="datetime-local"
                  required
                  value={form.occurredAt}
                  onChange={(e) => setForm((f) => ({ ...f, occurredAt: e.target.value }))}
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
              <div className="space-y-1 md:col-span-2">
                <Label>Lugar</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Descripción</Label>
                <Textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Acciones inmediatas</Label>
                <Textarea
                  rows={2}
                  value={form.immediateActions}
                  onChange={(e) => setForm((f) => ({ ...f, immediateActions: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.humanRightsImpact}
                  onChange={(e) => setForm((f) => ({ ...f, humanRightsImpact: e.target.checked }))}
                />
                Impacto en derechos humanos
              </label>
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving || !form.title.trim() || !form.description.trim()}>
                  {saving ? "Guardando..." : "Registrar incidente"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Input className="max-w-xs" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyHr} onChange={(e) => setOnlyHr(e.target.checked)} />
            Solo DDHH
          </label>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registro</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <p className="text-sm text-slate-500">Cargando...</p>
            ) : (
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Código</th>
                    <th className="px-2 py-2">Incidente</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">Fecha</th>
                    <th className="px-2 py-2">Severidad</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">Semáforo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b align-top">
                      <td className="px-2 py-2">
                        <Link
                          href={`/sig/incidentes/${row.id}`}
                          className="font-medium text-red-700 hover:underline"
                        >
                          {row.code}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        {row.title}
                        {row.humanRightsImpact && (
                          <Badge variant="danger" className="ml-2">
                            DDHH
                          </Badge>
                        )}
                        {row.location && (
                          <div className="text-xs text-slate-500">{row.location}</div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs">{TYPE_LABEL[row.type] ?? row.type}</td>
                      <td className="px-2 py-2 text-xs">{formatDate(row.occurredAt)}</td>
                      <td className="px-2 py-2 text-xs">{row.severity}</td>
                      <td className="px-2 py-2 text-xs">{row.status}</td>
                      <td className="px-2 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ${LIGHT_STYLE[row.trafficLight]}`}>
                          {row.trafficLight}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-2 py-6 text-center text-slate-500">
                        Sin incidentes
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
