"use client";

import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils/format";

type EvidenceRow = {
  id: string;
  code: string;
  type: string;
  description: string;
  evidenceDate: string;
  validUntil: string | null;
  status: string;
  fileName: string | null;
  process: { id: string; code: string; name: string } | null;
  requirementLinks: Array<{
    requirement: { id: string; code: string; title: string; standard: { code: string } };
  }>;
};

const TYPES = [
  "PHOTO",
  "PDF",
  "EXCEL",
  "RECORD",
  "EMAIL",
  "ACTA",
  "CERTIFICATE",
  "INTERVIEW",
  "SCREENSHOT",
  "VIDEO",
  "FORM",
  "INSPECTION",
  "OTHER",
] as const;

export default function SigEvidenciasPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "PDF" as (typeof TYPES)[number],
    description: "",
    evidenceDate: new Date().toISOString().slice(0, 10),
    validUntil: "",
    processId: "",
    requirementId: "",
  });
  const [file, setFile] = useState<File | null>(null);

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
    queryKey: ["sig-evidences", q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch(`/api/sig/evidences?${params}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error cargando evidencias");
      const json = await r.json();
      return json.data as EvidenceRow[];
    },
  });

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("type", form.type);
      body.set("description", form.description);
      body.set("evidenceDate", form.evidenceDate);
      if (form.validUntil) body.set("validUntil", form.validUntil);
      if (form.processId) body.set("processId", form.processId);
      if (form.requirementId) body.set("requirementIds", JSON.stringify([form.requirementId]));
      if (file) body.set("file", file);
      const r = await fetch("/api/sig/evidences", { method: "POST", body });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo crear");
      setForm({
        type: "PDF",
        description: "",
        evidenceDate: new Date().toISOString().slice(0, 10),
        validUntil: "",
        processId: "",
        requirementId: "",
      });
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["sig-evidences"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title="Evidencias SIG" />
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar evidencia</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as (typeof TYPES)[number] }))}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={form.evidenceDate}
                  onChange={(e) => setForm((p) => ({ ...p, evidenceDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Vigencia hasta</Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm((p) => ({ ...p, validUntil: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Proceso</Label>
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
              <div className="space-y-1 md:col-span-2">
                <Label>Requisito asociado</Label>
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
                  required
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Archivo (opcional)</Label>
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <Button disabled={saving}>{saving ? "Guardando..." : "Registrar evidencia"}</Button>
            </form>
            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código o descripción" />
            <div className="overflow-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Descripción</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Proceso</th>
                    <th className="px-3 py-2">Requisitos</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2"></th>
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
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{row.code}</td>
                      <td className="px-3 py-2">{row.type}</td>
                      <td className="px-3 py-2 max-w-xs truncate">{row.description}</td>
                      <td className="px-3 py-2">{formatDate(row.evidenceDate)}</td>
                      <td className="px-3 py-2">{row.process?.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.requirementLinks.map((l) => `${l.requirement.standard.code} ${l.requirement.code}`).join(", ") ||
                          "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={row.status === "ACTIVE" ? "success" : "outline"}>{row.status}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        {row.fileName && (
                          <a
                            className="text-red-700 hover:underline"
                            href={`/api/sig/evidences/${row.id}?download=1`}
                          >
                            Descargar
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
