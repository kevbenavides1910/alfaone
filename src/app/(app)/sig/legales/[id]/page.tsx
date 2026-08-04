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

type TrafficLight = "GREEN" | "YELLOW" | "RED" | "GRAY";

type Detail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  legalSource: string;
  authority: string | null;
  articleRef: string | null;
  jurisdiction: string | null;
  complianceStatus: string;
  evaluationNotes: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  nextReviewDate: string | null;
  trafficLight: TrafficLight;
  reviewOverdue: boolean;
  expired: boolean;
  process: { id: string; code: string; name: string } | null;
  documentLinks: Array<{
    document: { id: string; code: string; title: string; status: string };
  }>;
  controlLinks: Array<{ control: { id: string; code: string; title: string; status: string } }>;
  evidenceLinks: Array<{
    evidence: { id: string; code: string; description: string; evidenceDate: string };
  }>;
};

const LIGHT_STYLE: Record<TrafficLight, string> = {
  GREEN: "bg-emerald-100 text-emerald-800",
  YELLOW: "bg-amber-100 text-amber-800",
  RED: "bg-red-100 text-red-800",
  GRAY: "bg-slate-100 text-slate-600",
};

const STATUSES = [
  "COMPLIANT",
  "PARTIAL",
  "NON_COMPLIANT",
  "NOT_EVALUATED",
  "NOT_APPLICABLE",
] as const;

export default function SigLegalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [documentId, setDocumentId] = useState("");
  const [controlId, setControlId] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [edit, setEdit] = useState({
    complianceStatus: "",
    evaluationNotes: "",
    nextReviewDate: "",
    effectiveUntil: "",
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["sig-docs-link"],
    queryFn: async () => {
      const r = await fetch("/api/sig/documents?pageSize=200", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error documentos");
      const json = await r.json();
      return (json.data?.rows ?? []) as Array<{ id: string; code: string; title: string }>;
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

  const { data: evidences = [] } = useQuery({
    queryKey: ["sig-evidences-picker"],
    queryFn: async () => {
      const r = await fetch("/api/sig/evidences", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error evidencias");
      const json = await r.json();
      return json.data as Array<{ id: string; code: string; description: string }>;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sig-legal", id],
    queryFn: async () => {
      const r = await fetch(`/api/sig/legal/${id}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Requisito legal no encontrado");
      const json = await r.json();
      return json.data as Detail;
    },
  });

  useEffect(() => {
    if (!data) return;
    setEdit({
      complianceStatus: data.complianceStatus,
      evaluationNotes: data.evaluationNotes ?? "",
      nextReviewDate: data.nextReviewDate ? data.nextReviewDate.slice(0, 10) : "",
      effectiveUntil: data.effectiveUntil ? data.effectiveUntil.slice(0, 10) : "",
    });
  }, [data]);

  async function link(body: Record<string, string>, action?: string) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/sig/legal/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, action }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo vincular");
      await qc.invalidateQueries({ queryKey: ["sig-legal", id] });
      await qc.invalidateQueries({ queryKey: ["sig-legal"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/sig/legal/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complianceStatus: edit.complianceStatus,
          evaluationNotes: edit.evaluationNotes || null,
          nextReviewDate: edit.nextReviewDate || null,
          effectiveUntil: edit.effectiveUntil || null,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo guardar");
      await qc.invalidateQueries({ queryKey: ["sig-legal", id] });
      await qc.invalidateQueries({ queryKey: ["sig-legal"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <Topbar title="Requisito legal" />
        <div className="p-6 text-slate-500">{isLoading ? "Cargando..." : "No encontrado"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title={data.code} />
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <Link href="/sig/legales" className="text-sm text-red-600 hover:underline">
          Volver a legales
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>
              {data.code} — {data.title}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{data.legalSource}</Badge>
              {data.articleRef && <Badge variant="outline">{data.articleRef}</Badge>}
              {data.jurisdiction && <Badge variant="outline">{data.jurisdiction}</Badge>}
              <span className={`rounded px-2 py-0.5 text-xs ${LIGHT_STYLE[data.trafficLight]}`}>
                {data.trafficLight}
              </span>
              {data.reviewOverdue && <Badge variant="danger">Revisión vencida</Badge>}
              {data.expired && <Badge variant="danger">Vigencia vencida</Badge>}
              {data.process && (
                <Link href={`/sig/procesos/${data.process.id}`}>
                  <Badge variant="outline">
                    {data.process.code} — {data.process.name}
                  </Badge>
                </Link>
              )}
            </div>
            {data.description && <p className="text-sm text-slate-600">{data.description}</p>}
            {data.authority && <p className="text-xs text-slate-500">Autoridad: {data.authority}</p>}
          </CardHeader>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evaluación de cumplimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onSave}>
              <div className="space-y-1">
                <Label>Estado</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={edit.complianceStatus}
                  onChange={(e) => setEdit((f) => ({ ...f, complianceStatus: e.target.value }))}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Próxima revisión</Label>
                <Input
                  type="date"
                  value={edit.nextReviewDate}
                  onChange={(e) => setEdit((f) => ({ ...f, nextReviewDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Vigente hasta</Label>
                <Input
                  type="date"
                  value={edit.effectiveUntil}
                  onChange={(e) => setEdit((f) => ({ ...f, effectiveUntil: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Notas de evaluación</Label>
                <Textarea
                  rows={3}
                  value={edit.evaluationNotes}
                  onChange={(e) => setEdit((f) => ({ ...f, evaluationNotes: e.target.value }))}
                />
              </div>
              <div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar evaluación"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {data.documentLinks.map((l) => (
                <li key={l.document.id} className="flex items-center justify-between gap-2">
                  <Link href={`/sig/documentos/${l.document.id}`} className="text-red-700 hover:underline">
                    {l.document.code} — {l.document.title}
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void link({ documentId: l.document.id }, "unlink")}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
              {data.documentLinks.length === 0 && <li className="text-slate-500">Sin documentos</li>}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!documentId) return;
                void link({ documentId }).then(() => setDocumentId(""));
              }}
            >
              <select
                className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
              >
                <option value="">Seleccionar documento</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.title}
                  </option>
                ))}
              </select>
              <Button disabled={saving || !documentId}>Vincular</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Controles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {data.controlLinks.map((l) => (
                <li key={l.control.id} className="flex items-center justify-between gap-2">
                  <Link href={`/sig/controles/${l.control.id}`} className="text-red-700 hover:underline">
                    {l.control.code} — {l.control.title}
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void link({ controlId: l.control.id }, "unlink")}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
              {data.controlLinks.length === 0 && <li className="text-slate-500">Sin controles</li>}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!controlId) return;
                void link({ controlId }).then(() => setControlId(""));
              }}
            >
              <select
                className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                value={controlId}
                onChange={(e) => setControlId(e.target.value)}
              >
                <option value="">Seleccionar control</option>
                {controls.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
              <Button disabled={saving || !controlId}>Vincular</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evidencias de cumplimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {data.evidenceLinks.map((l) => (
                <li key={l.evidence.id} className="flex items-center justify-between gap-2">
                  <span>
                    {l.evidence.code} — {l.evidence.description.slice(0, 80)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void link({ evidenceId: l.evidence.id }, "unlink")}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
              {data.evidenceLinks.length === 0 && <li className="text-slate-500">Sin evidencias</li>}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!evidenceId) return;
                void link({ evidenceId }).then(() => setEvidenceId(""));
              }}
            >
              <select
                className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                value={evidenceId}
                onChange={(e) => setEvidenceId(e.target.value)}
              >
                <option value="">Seleccionar evidencia</option>
                {evidences.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.code} — {ev.description.slice(0, 60)}
                  </option>
                ))}
              </select>
              <Button disabled={saving || !evidenceId}>Vincular</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
