"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ControlRow = {
  id: string;
  code: string;
  title: string;
  status: string;
  evidenceIntervalDays: number | null;
  freshness: "OK" | "DUE_SOON" | "OVERDUE" | "NO_EVIDENCE" | "INACTIVE";
  process: { id: string; code: string; name: string } | null;
  _count: {
    requirementLinks: number;
    processLinks: number;
    documentLinks: number;
    evidenceLinks: number;
  };
};

const FRESHNESS: Record<ControlRow["freshness"], { label: string; className: string }> = {
  OK: { label: "Al día", className: "bg-emerald-100 text-emerald-800" },
  DUE_SOON: { label: "Por vencer", className: "bg-amber-100 text-amber-800" },
  OVERDUE: { label: "Vencido", className: "bg-red-100 text-red-800" },
  NO_EVIDENCE: { label: "Sin evidencia", className: "bg-slate-100 text-slate-700" },
  INACTIVE: { label: "Inactivo", className: "bg-slate-200 text-slate-600" },
};

export default function SigControlesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [processId, setProcessId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    processId: "",
    evidenceIntervalDays: "365",
    requirementId: "",
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

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sig-controls", q, processId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (processId) params.set("processId", processId);
      const r = await fetch(`/api/sig/controls?${params}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error cargando controles");
      const json = await r.json();
      return json.data as ControlRow[];
    },
  });

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/sig/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          processId: form.processId || null,
          evidenceIntervalDays: form.evidenceIntervalDays ? Number(form.evidenceIntervalDays) : null,
          requirementIds: form.requirementId ? [form.requirementId] : [],
          processIds: form.processId ? [form.processId] : [],
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo crear");
      setForm({ title: "", description: "", processId: "", evidenceIntervalDays: "365", requirementId: "" });
      await qc.invalidateQueries({ queryKey: ["sig-controls"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title="Controles SIG" />
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo control</CardTitle>
            <p className="text-sm text-slate-500">
              Un control demuestra cumplimiento de uno o más requisitos mediante documentos y evidencias.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <Label>Título</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required
                  placeholder="Ej. Validación anual de competencia de oficiales"
                />
              </div>
              <div className="space-y-1">
                <Label>Proceso principal</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.processId}
                  onChange={(e) => setForm((p) => ({ ...p, processId: e.target.value }))}
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
                <Label>Intervalo de evidencia (días)</Label>
                <Input
                  type="number"
                  value={form.evidenceIntervalDays}
                  onChange={(e) => setForm((p) => ({ ...p, evidenceIntervalDays: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Requisito inicial</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.requirementId}
                  onChange={(e) => setForm((p) => ({ ...p, requirementId: e.target.value }))}
                >
                  <option value="">Sin requisito</option>
                  {requirements.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.standard.code} {r.code} — {r.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Descripción</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <Button disabled={saving}>{saving ? "Creando..." : "Crear control"}</Button>
            </form>
            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-3">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar control" />
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="overflow-auto p-0">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Frescura</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Control</th>
                  <th className="px-3 py-2">Proceso</th>
                  <th className="px-3 py-2">Req.</th>
                  <th className="px-3 py-2">Docs</th>
                  <th className="px-3 py-2">Evid.</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                      Cargando...
                    </td>
                  </tr>
                )}
                {rows.map((row) => {
                  const f = FRESHNESS[row.freshness];
                  return (
                    <tr key={row.id} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${f.className}`}>{f.label}</span>
                      </td>
                      <td className="px-3 py-2 font-medium">
                        <Link href={`/sig/controles/${row.id}`} className="text-red-700 hover:underline">
                          {row.code}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">
                        {row.process ? (
                          <Link href={`/sig/procesos/${row.process.id}`} className="hover:underline">
                            {row.process.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">{row._count.requirementLinks}</td>
                      <td className="px-3 py-2">{row._count.documentLinks}</td>
                      <td className="px-3 py-2">{row._count.evidenceLinks}</td>
                      <td className="px-3 py-2">
                        <Badge variant={row.status === "ACTIVE" ? "success" : "outline"}>{row.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
