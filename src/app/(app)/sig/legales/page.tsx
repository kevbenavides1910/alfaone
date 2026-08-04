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

type TrafficLight = "GREEN" | "YELLOW" | "RED" | "GRAY";

type LegalRow = {
  id: string;
  code: string;
  title: string;
  legalSource: string;
  authority: string | null;
  articleRef: string | null;
  jurisdiction: string | null;
  complianceStatus: string;
  trafficLight: TrafficLight;
  reviewOverdue: boolean;
  expired: boolean;
  nextReviewDate: string | null;
  process: { id: string; code: string; name: string } | null;
  _count: {
    processLinks: number;
    documentLinks: number;
    controlLinks: number;
    evidenceLinks: number;
  };
};

const LIGHT_STYLE: Record<TrafficLight, string> = {
  GREEN: "bg-emerald-100 text-emerald-800",
  YELLOW: "bg-amber-100 text-amber-800",
  RED: "bg-red-100 text-red-800",
  GRAY: "bg-slate-100 text-slate-600",
};

const STATUS_LABEL: Record<string, string> = {
  COMPLIANT: "Cumple",
  PARTIAL: "Parcial",
  NON_COMPLIANT: "No cumple",
  NOT_EVALUATED: "Sin evaluar",
  NOT_APPLICABLE: "N/A",
};

export default function SigLegalesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [processId, setProcessId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    legalSource: "",
    authority: "",
    articleRef: "",
    jurisdiction: "CR",
    processId: "",
    description: "",
    complianceStatus: "NOT_EVALUATED",
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
    queryKey: ["sig-legal", q, processId, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (processId) params.set("processId", processId);
      if (status) params.set("complianceStatus", status);
      const r = await fetch(`/api/sig/legal?${params}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error cargando requisitos legales");
      const json = await r.json();
      return json.data as LegalRow[];
    },
  });

  const summary = useMemo(() => {
    return {
      total: rows.length,
      red: rows.filter((r) => r.trafficLight === "RED").length,
      yellow: rows.filter((r) => r.trafficLight === "YELLOW").length,
      green: rows.filter((r) => r.trafficLight === "GREEN").length,
    };
  }, [rows]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/sig/legal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          legalSource: form.legalSource,
          authority: form.authority || null,
          articleRef: form.articleRef || null,
          jurisdiction: form.jurisdiction || "CR",
          processId: form.processId || null,
          processIds: form.processId ? [form.processId] : [],
          description: form.description || null,
          complianceStatus: form.complianceStatus,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo crear");
      setForm({
        title: "",
        legalSource: "",
        authority: "",
        articleRef: "",
        jurisdiction: "CR",
        processId: "",
        description: "",
        complianceStatus: "NOT_EVALUATED",
      });
      await qc.invalidateQueries({ queryKey: ["sig-legal"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando requisito legal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="Requisitos legales SIG" />
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cumplimiento normativo</p>
          <h1 className="text-2xl font-semibold text-slate-900">Matriz de requisitos legales</h1>
          <p className="text-sm text-slate-500">
            Leyes, decretos, reglamentos y obligaciones aplicables. Semáforo por cumplimiento, revisión y evidencia.
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
            <CardTitle className="text-base">Registrar requisito legal</CardTitle>
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
                <Label>Fuente legal</Label>
                <Input
                  required
                  placeholder="Ley, decreto, reglamento..."
                  value={form.legalSource}
                  onChange={(e) => setForm((f) => ({ ...f, legalSource: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Autoridad</Label>
                <Input
                  value={form.authority}
                  onChange={(e) => setForm((f) => ({ ...f, authority: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Artículo / cláusula</Label>
                <Input
                  value={form.articleRef}
                  onChange={(e) => setForm((f) => ({ ...f, articleRef: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Jurisdicción</Label>
                <Input
                  value={form.jurisdiction}
                  onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))}
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
                <Label>Estado inicial</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.complianceStatus}
                  onChange={(e) => setForm((f) => ({ ...f, complianceStatus: e.target.value }))}
                >
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Descripción / obligación</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving || !form.title.trim() || !form.legalSource.trim()}>
                  {saving ? "Guardando..." : "Crear requisito"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
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
                    <th className="px-2 py-2">Requisito</th>
                    <th className="px-2 py-2">Fuente</th>
                    <th className="px-2 py-2">Proceso</th>
                    <th className="px-2 py-2">Cumplimiento</th>
                    <th className="px-2 py-2">Semáforo</th>
                    <th className="px-2 py-2">Evidencias</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b align-top">
                      <td className="px-2 py-2">
                        <Link href={`/sig/legales/${row.id}`} className="font-medium text-red-700 hover:underline">
                          {row.code}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        {row.title}
                        {(row.reviewOverdue || row.expired) && (
                          <span className="ml-2 text-xs text-red-600">
                            {row.expired ? "Vigencia vencida" : "Revisión vencida"}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {row.legalSource}
                        {row.articleRef ? ` · ${row.articleRef}` : ""}
                      </td>
                      <td className="px-2 py-2 text-xs">{row.process?.code ?? "—"}</td>
                      <td className="px-2 py-2 text-xs">
                        {STATUS_LABEL[row.complianceStatus] ?? row.complianceStatus}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ${LIGHT_STYLE[row.trafficLight]}`}>
                          {row.trafficLight}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-500">
                        {row._count.evidenceLinks} evid. · {row._count.controlLinks} ctrl
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-2 py-6 text-center text-slate-500">
                        Sin requisitos legales
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
