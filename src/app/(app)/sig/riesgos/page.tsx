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

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type RiskRow = {
  id: string;
  code: string;
  title: string;
  kind: "RISK" | "OPPORTUNITY";
  status: string;
  likelihood: number;
  impact: number;
  inherentScore: number;
  residualScore: number | null;
  inherentLevel: RiskLevel;
  residualLevel: RiskLevel | null;
  reviewOverdue: boolean;
  nextReviewDate: string | null;
  process: { id: string; code: string; name: string } | null;
  _count: {
    processLinks: number;
    controlLinks: number;
    requirementLinks: number;
    evidenceLinks: number;
  };
};

const LEVEL_STYLE: Record<RiskLevel, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-emerald-100 text-emerald-800",
};

export default function SigRiesgosPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [processId, setProcessId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    kind: "RISK",
    processId: "",
    likelihood: "3",
    impact: "3",
    treatment: "",
    requirementId: "",
    controlId: "",
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

  const { data: requirements = [] } = useQuery({
    queryKey: ["sig-requirements-picker"],
    queryFn: async () => {
      const r = await fetch("/api/sig/requirements?applicable=1", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error requisitos");
      const json = await r.json();
      return json.data as Array<{ id: string; code: string; title: string; standard: { code: string } }>;
    },
  });

  const { data: controls = [] } = useQuery({
    queryKey: ["sig-controls-picker"],
    queryFn: async () => {
      const r = await fetch("/api/sig/controls", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error controles");
      const json = await r.json();
      return json.data as Array<{ id: string; code: string; title: string }>;
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sig-risks", q, kind, processId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (kind) params.set("kind", kind);
      if (processId) params.set("processId", processId);
      const r = await fetch(`/api/sig/risks?${params}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error cargando riesgos");
      const json = await r.json();
      return json.data as RiskRow[];
    },
  });

  const summary = useMemo(() => {
    const open = rows.filter((r) => r.status !== "CLOSED");
    return {
      total: rows.length,
      high: open.filter((r) => (r.residualLevel ?? r.inherentLevel) === "HIGH" || (r.residualLevel ?? r.inherentLevel) === "CRITICAL").length,
      overdue: open.filter((r) => r.reviewOverdue).length,
      opportunities: open.filter((r) => r.kind === "OPPORTUNITY").length,
    };
  }, [rows]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/sig/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          kind: form.kind,
          processId: form.processId || null,
          processIds: form.processId ? [form.processId] : [],
          likelihood: Number(form.likelihood),
          impact: Number(form.impact),
          treatment: form.treatment || null,
          requirementIds: form.requirementId ? [form.requirementId] : [],
          controlIds: form.controlId ? [form.controlId] : [],
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo crear");
      setForm({
        title: "",
        description: "",
        kind: "RISK",
        processId: "",
        likelihood: "3",
        impact: "3",
        treatment: "",
        requirementId: "",
        controlId: "",
      });
      await qc.invalidateQueries({ queryKey: ["sig-risks"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando riesgo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="Riesgos y oportunidades SIG" />
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ISO 9001 · 6.1</p>
          <h1 className="text-2xl font-semibold text-slate-900">Matriz de riesgos y oportunidades</h1>
          <p className="text-sm text-slate-500">
            Probabilidad × impacto (1–5). Nivel residual si hay tratamiento. Vincula procesos, controles y requisitos.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Registros</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{summary.total}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Alta / crítica</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-orange-700">{summary.high}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Revisión vencida</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-red-700">{summary.overdue}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Oportunidades</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-emerald-700">{summary.opportunities}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.kind}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                >
                  <option value="RISK">Riesgo</option>
                  <option value="OPPORTUNITY">Oportunidad</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Proceso</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                <Label>Probabilidad (1–5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={form.likelihood}
                  onChange={(e) => setForm((f) => ({ ...f, likelihood: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Impacto (1–5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={form.impact}
                  onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Descripción</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Tratamiento / acción</Label>
                <Textarea
                  value={form.treatment}
                  onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label>Requisito (opcional)</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.requirementId}
                  onChange={(e) => setForm((f) => ({ ...f, requirementId: e.target.value }))}
                >
                  <option value="">Ninguno</option>
                  {requirements.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.standard.code} {r.code} — {r.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Control (opcional)</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.controlId}
                  onChange={(e) => setForm((f) => ({ ...f, controlId: e.target.value }))}
                >
                  <option value="">Ninguno</option>
                  {controls.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving || !form.title.trim()}>
                  {saving ? "Guardando..." : "Crear registro"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Buscar..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            <option value="RISK">Riesgos</option>
            <option value="OPPORTUNITY">Oportunidades</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
            <CardTitle className="text-base">Matriz</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <p className="text-sm text-slate-500">Cargando...</p>
            ) : (
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Código</th>
                    <th className="px-2 py-2">Título</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">Proceso</th>
                    <th className="px-2 py-2">Inherente</th>
                    <th className="px-2 py-2">Residual</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">Vínculos</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b align-top">
                      <td className="px-2 py-2">
                        <Link href={`/sig/riesgos/${row.id}`} className="font-medium text-red-700 hover:underline">
                          {row.code}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        {row.title}
                        {row.reviewOverdue && (
                          <span className="ml-2 text-xs text-red-600">Revisión vencida</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {row.kind === "OPPORTUNITY" ? "Oportunidad" : "Riesgo"}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {row.process ? `${row.process.code}` : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ${LEVEL_STYLE[row.inherentLevel]}`}>
                          {row.likelihood}×{row.impact}={row.inherentScore} {row.inherentLevel}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {row.residualScore != null && row.residualLevel ? (
                          <span className={`rounded px-1.5 py-0.5 text-xs ${LEVEL_STYLE[row.residualLevel]}`}>
                            {row.residualScore} {row.residualLevel}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs">{row.status}</td>
                      <td className="px-2 py-2 text-xs text-slate-500">
                        {row._count.controlLinks} ctrl · {row._count.requirementLinks} req ·{" "}
                        {row._count.evidenceLinks} evid.
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-2 py-6 text-center text-slate-500">
                        Sin registros
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
