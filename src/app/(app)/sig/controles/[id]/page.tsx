"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Detail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: string;
  evidenceIntervalDays: number | null;
  process: { id: string; code: string; name: string } | null;
  requirementLinks: Array<{
    requirement: { id: string; code: string; title: string; standard: { code: string } };
  }>;
  processLinks: Array<{ process: { id: string; code: string; name: string } }>;
  documentLinks: Array<{ document: { id: string; code: string; title: string; status: string } }>;
  evidenceLinks: Array<{
    evidence: { id: string; code: string; description: string; evidenceDate: string; status: string };
  }>;
};

export default function SigControlDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requirementId, setRequirementId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [evidenceId, setEvidenceId] = useState("");

  const { data: requirements = [] } = useQuery({
    queryKey: ["sig-requirements-picker"],
    queryFn: async () => {
      const r = await fetch("/api/sig/requirements?applicable=1", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error requisitos");
      const json = await r.json();
      return json.data as Array<{ id: string; code: string; title: string; standard: { code: string } }>;
    },
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
    queryKey: ["sig-control", id],
    queryFn: async () => {
      const r = await fetch(`/api/sig/controls/${id}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Control no encontrado");
      const json = await r.json();
      return json.data as Detail;
    },
  });

  async function link(body: Record<string, string>, action?: string) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/sig/controls/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, action }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo vincular");
      await qc.invalidateQueries({ queryKey: ["sig-control", id] });
      await qc.invalidateQueries({ queryKey: ["sig-controls"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function onLinkRequirement(e: FormEvent) {
    e.preventDefault();
    if (!requirementId) return;
    await link({ requirementId });
    setRequirementId("");
  }

  async function onLinkDocument(e: FormEvent) {
    e.preventDefault();
    if (!documentId) return;
    await link({ documentId });
    setDocumentId("");
  }

  async function onLinkEvidence(e: FormEvent) {
    e.preventDefault();
    if (!evidenceId) return;
    await link({ evidenceId });
    setEvidenceId("");
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <Topbar title="Control SIG" />
        <div className="p-6 text-slate-500">{isLoading ? "Cargando..." : "No encontrado"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title={data.code} />
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <Link href="/sig/controles" className="text-sm text-red-600 hover:underline">
          Volver a controles
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>
              {data.code} — {data.title}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant={data.status === "ACTIVE" ? "success" : "outline"}>{data.status}</Badge>
              {data.process && (
                <Link href={`/sig/procesos/${data.process.id}`}>
                  <Badge variant="outline">
                    {data.process.code} — {data.process.name}
                  </Badge>
                </Link>
              )}
              {data.evidenceIntervalDays && (
                <Badge variant="outline">Cada {data.evidenceIntervalDays} días</Badge>
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
            <CardTitle className="text-base">Requisitos cubiertos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {data.requirementLinks.map((l) => (
                <li key={l.requirement.id} className="flex items-center justify-between gap-2">
                  <Link href={`/sig/requisitos/${l.requirement.id}`} className="text-red-700 hover:underline">
                    {l.requirement.standard.code} {l.requirement.code} — {l.requirement.title}
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void link({ requirementId: l.requirement.id }, "unlink")}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
              {data.requirementLinks.length === 0 && <li className="text-slate-500">Sin requisitos</li>}
            </ul>
            <form onSubmit={onLinkRequirement} className="flex gap-2">
              <select
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                value={requirementId}
                onChange={(e) => setRequirementId(e.target.value)}
              >
                <option value="">Seleccionar requisito</option>
                {requirements.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.standard.code} {r.code} — {r.title}
                  </option>
                ))}
              </select>
              <Button disabled={saving || !requirementId}>Vincular</Button>
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
            <form onSubmit={onLinkDocument} className="flex gap-2">
              <select
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
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
            <CardTitle className="text-base">Evidencias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {data.evidenceLinks.map((l) => (
                <li key={l.evidence.id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{l.evidence.code}</span> — {l.evidence.description}
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
            <form onSubmit={onLinkEvidence} className="flex gap-2">
              <select
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
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
            <p className="text-xs text-slate-500">
              También puede crear evidencias en{" "}
              <Link href="/sig/evidencias" className="text-red-700 hover:underline">
                Evidencias
              </Link>{" "}
              y vincularlas aquí.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
