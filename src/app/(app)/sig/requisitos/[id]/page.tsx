"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Detail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  observations: string | null;
  isApplicable: boolean;
  lastReviewedAt: string | null;
  lastRevisionAt: string | null;
  standard: { id: string; code: string; name: string };
  processLinks: Array<{ id: string; process: { id: string; code: string; name: string } }>;
  documentLinks: Array<{
    id: string;
    document: {
      id: string;
      code: string;
      title: string;
      status: string;
      currentVersion: { revisionDate: string | null; versionLabel: string | null } | null;
    };
  }>;
  evidenceLinks: Array<{
    id: string;
    evidence: {
      id: string;
      code: string;
      type: string;
      description: string;
      evidenceDate: string;
      status: string;
      fileName: string | null;
    };
  }>;
  findingLinks: Array<{
    id: string;
    finding: {
      id: string;
      title: string;
      findingType: string;
      status: string;
      severity: string;
      auditId: string;
    };
  }>;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "2-digit" });
}

export default function SigRequisitoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [processId, setProcessId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [description, setDescription] = useState("");
  const [observations, setObservations] = useState("");
  const [isApplicable, setIsApplicable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: processesRaw } = useQuery({
    queryKey: ["sig-procesos-options"],
    queryFn: async () => {
      const r = await fetch("/api/sig/procesos", { credentials: "same-origin" });
      if (!r.ok) return [] as Array<{ id: string; code: string; name: string }>;
      const json = await r.json();
      // Compat: caché vieja de Biblioteca guardaba `{ data: [...] }` completo.
      if (Array.isArray(json.data)) return json.data as Array<{ id: string; code: string; name: string }>;
      if (Array.isArray(json)) return json as Array<{ id: string; code: string; name: string }>;
      return [] as Array<{ id: string; code: string; name: string }>;
    },
  });
  const processes = Array.isArray(processesRaw)
    ? processesRaw
    : Array.isArray((processesRaw as { data?: unknown } | undefined)?.data)
      ? ((processesRaw as { data: Array<{ id: string; code: string; name: string }> }).data)
      : [];

  const { data: documentsRaw } = useQuery({
    queryKey: ["sig-docs-link"],
    queryFn: async () => {
      const r = await fetch("/api/sig/documents?pageSize=200", { credentials: "same-origin" });
      if (!r.ok) return [] as Array<{ id: string; code: string; title: string }>;
      const json = await r.json();
      const rows = json.data?.rows ?? json.data?.items;
      return (Array.isArray(rows) ? rows : []) as Array<{ id: string; code: string; title: string }>;
    },
  });
  const documents = Array.isArray(documentsRaw) ? documentsRaw : [];

  const { data: evidencesRaw } = useQuery({
    queryKey: ["sig-evidences-link"],
    queryFn: async () => {
      const r = await fetch("/api/sig/evidences", { credentials: "same-origin" });
      if (!r.ok) return [] as Array<{ id: string; code: string; description: string }>;
      const json = await r.json();
      return (Array.isArray(json.data) ? json.data : []) as Array<{
        id: string;
        code: string;
        description: string;
      }>;
    },
  });
  const evidences = Array.isArray(evidencesRaw) ? evidencesRaw : [];

  const { data, isLoading } = useQuery({
    queryKey: ["sig-requirement", id],
    queryFn: async () => {
      const r = await fetch(`/api/sig/requirements/${id}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("No se pudo cargar el requisito");
      const json = await r.json();
      return json.data as Detail;
    },
  });

  useEffect(() => {
    if (!data) return;
    setDescription(data.description ?? "");
    setObservations(data.observations ?? "");
    setIsApplicable(data.isApplicable);
  }, [data]);

  async function link(action: string, body: Record<string, string>) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/sig/requirements/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo vincular");
      await qc.invalidateQueries({ queryKey: ["sig-requirement", id] });
      await qc.invalidateQueries({ queryKey: ["sig-requirements"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function saveCompliance(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/sig/requirements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim() || null,
          observations: observations.trim() || null,
          isApplicable,
          touchReviewed: true,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo guardar");
      await qc.invalidateQueries({ queryKey: ["sig-requirement", id] });
      await qc.invalidateQueries({ queryKey: ["sig-requirements"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function loadSuggestedObservations() {
    setSuggesting(true);
    setError(null);
    try {
      const r = await fetch(`/api/sig/requirements/${id}?suggest=observations`, {
        credentials: "same-origin",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo generar el borrador");
      setObservations(json.data.draft as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSuggesting(false);
    }
  }

  async function onLinkProcess(e: FormEvent) {
    e.preventDefault();
    if (!processId) return;
    await link("link-process", { processId });
    setProcessId("");
  }

  async function onLinkDocument(e: FormEvent) {
    e.preventDefault();
    if (!documentId) return;
    await link("link-document", { documentId });
    setDocumentId("");
  }

  async function onLinkEvidence(e: FormEvent) {
    e.preventDefault();
    if (!evidenceId) return;
    await link("link-evidence", { evidenceId });
    setEvidenceId("");
  }

  async function onUploadEvidence(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) {
      setError("Seleccione un archivo de prueba");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("type", String(fd.get("type") || "RECORD"));
      body.set("description", String(fd.get("description") || `Prueba de ${data?.code ?? id}`));
      body.set("evidenceDate", String(fd.get("evidenceDate") || new Date().toISOString().slice(0, 10)));
      body.set("requirementIds", JSON.stringify([id]));
      body.set("file", file);
      const r = await fetch("/api/sig/evidences", { method: "POST", body });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo adjuntar la evidencia");
      form.reset();
      await qc.invalidateQueries({ queryKey: ["sig-requirement", id] });
      await qc.invalidateQueries({ queryKey: ["sig-requirements"] });
      await qc.invalidateQueries({ queryKey: ["sig-evidences-link"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setUploading(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <Topbar title="Requisito SIG" />
        <div className="p-6 text-slate-500">{isLoading ? "Cargando..." : "No encontrado"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title={`${data.standard.code} ${data.code}`} />
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/sig/requisitos" className="text-sm text-red-600 hover:underline">
            Volver a la matriz
          </Link>
          <p className="text-sm text-slate-600">
            Última revisión: <span className="font-medium text-slate-800">{formatDate(data.lastRevisionAt)}</span>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {data.standard.code} {data.code} — {data.title}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant={data.isApplicable ? "success" : "outline"}>
                {data.isApplicable ? "Aplicable" : "No aplicable"}
              </Badge>
              <Badge variant="outline">{data.standard.name}</Badge>
              <Badge variant="outline">Revisión {formatDate(data.lastRevisionAt)}</Badge>
            </div>
          </CardHeader>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cumplimiento y observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveCompliance} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="description">Requisito esperado</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Qué debe demostrar la organización para cumplir este requisito…"
                />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="observations">Observaciones</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={suggesting || saving}
                    onClick={() => void loadSuggestedObservations()}
                  >
                    {suggesting ? "Generando…" : "Sugerir borrador"}
                  </Button>
                </div>
                <Textarea
                  id="observations"
                  rows={6}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Sus notas de cumplimiento, brechas y seguimiento. Puede editar el borrador sugerido."
                />
                <p className="text-xs text-slate-500">
                  El borrador es editable: guarde cuando refleje la realidad del SGC.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isApplicable}
                  onChange={(e) => setIsApplicable(e.target.checked)}
                />
                Requisito aplicable al alcance
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Procesos relacionados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {(data.processLinks ?? []).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <span>
                    {l.process.code} — {l.process.name}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void link("unlink-process", { processId: l.process.id })}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
              {(data.processLinks ?? []).length === 0 && <li className="text-slate-500">Sin procesos vinculados</li>}
            </ul>
            <form onSubmit={onLinkProcess} className="flex gap-2">
              <select
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                value={processId}
                onChange={(e) => setProcessId(e.target.value)}
              >
                <option value="">Seleccionar proceso</option>
                {processes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
              <Button disabled={saving || !processId}>Vincular</Button>
            </form>
          </CardContent>
        </Card>

        <Card id="documentos">
          <CardHeader>
            <CardTitle className="text-base">Documentos de prueba / controlados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {(data.documentLinks ?? []).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <div>
                    <Link href={`/sig/documentos/${l.document.id}`} className="text-red-700 hover:underline">
                      {l.document.code} — {l.document.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      Rev. doc. {formatDate(l.document.currentVersion?.revisionDate)}
                      {l.document.currentVersion?.versionLabel
                        ? ` · ${l.document.currentVersion.versionLabel}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void link("unlink-document", { documentId: l.document.id })}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
              {(data.documentLinks ?? []).length === 0 && (
                <li className="text-slate-500">Sin documentos vinculados</li>
              )}
            </ul>
            <form onSubmit={onLinkDocument} className="flex gap-2">
              <select
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
              >
                <option value="">Ligar documento existente</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.title}
                  </option>
                ))}
              </select>
              <Button disabled={saving || !documentId}>Vincular</Button>
            </form>
            <p className="text-xs text-slate-500">
              ¿No está en la lista? Créelo en{" "}
              <Link href="/sig/documentos" className="text-red-700 hover:underline">
                Documentos SIG
              </Link>{" "}
              y luego líguelo aquí.
            </p>
          </CardContent>
        </Card>

        <Card id="evidencias">
          <CardHeader>
            <CardTitle className="text-base">Evidencias objetivas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {(data.evidenceLinks ?? []).map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-2">
                  <div>
                    <Link href="/sig/evidencias" className="font-medium text-red-700 hover:underline">
                      {l.evidence.code}
                    </Link>{" "}
                    — {l.evidence.description}
                    <p className="text-xs text-slate-500">
                      {formatDate(l.evidence.evidenceDate)}
                      {l.evidence.fileName ? ` · ${l.evidence.fileName}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void link("unlink-evidence", { evidenceId: l.evidence.id })}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
              {(data.evidenceLinks ?? []).length === 0 && <li className="text-slate-500">Sin evidencias</li>}
            </ul>

            <form onSubmit={onLinkEvidence} className="flex gap-2">
              <select
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                value={evidenceId}
                onChange={(e) => setEvidenceId(e.target.value)}
              >
                <option value="">Ligar evidencia existente</option>
                {evidences.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.code} — {ev.description}
                  </option>
                ))}
              </select>
              <Button disabled={saving || !evidenceId}>Vincular</Button>
            </form>

            <div className="rounded-md border border-dashed border-slate-300 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">Adjuntar archivo de prueba</p>
              <form onSubmit={onUploadEvidence} className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="ev-file">Archivo</Label>
                  <Input id="ev-file" name="file" type="file" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ev-desc">Descripción</Label>
                  <Input
                    id="ev-desc"
                    name="description"
                    placeholder={`Prueba de ${data.code}`}
                    defaultValue={`Prueba de cumplimiento ${data.code}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ev-date">Fecha evidencia</Label>
                  <Input
                    id="ev-date"
                    name="evidenceDate"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ev-type">Tipo</Label>
                  <select
                    id="ev-type"
                    name="type"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue="RECORD"
                  >
                    <option value="RECORD">Registro</option>
                    <option value="PDF">PDF</option>
                    <option value="PHOTO">Foto</option>
                    <option value="ACTA">Acta</option>
                    <option value="FORM">Formulario</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={uploading}>
                    {uploading ? "Subiendo…" : "Adjuntar y ligar"}
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hallazgos relacionados</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(data.findingLinks ?? []).map((l) => (
                <li key={l.id}>
                  <Link href={`/audits/${l.finding.auditId}`} className="text-red-700 hover:underline">
                    {l.finding.title}
                  </Link>{" "}
                  <Badge variant="outline">{l.finding.findingType}</Badge>{" "}
                  <Badge variant={l.finding.status === "CLOSED" ? "success" : "danger"}>
                    {l.finding.status}
                  </Badge>
                </li>
              ))}
              {(data.findingLinks ?? []).length === 0 && <li className="text-slate-500">Sin hallazgos</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
