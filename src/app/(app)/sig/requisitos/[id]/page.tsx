"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Detail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  isApplicable: boolean;
  standard: { id: string; code: string; name: string };
  processLinks: Array<{ id: string; process: { id: string; code: string; name: string } }>;
  documentLinks: Array<{
    id: string;
    document: { id: string; code: string; title: string; status: string };
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

export default function SigRequisitoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [processId, setProcessId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: processes = [] } = useQuery({
    queryKey: ["sig-procesos-filter"],
    queryFn: async () => {
      const r = await fetch("/api/sig/procesos", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error procesos");
      const json = await r.json();
      return json.data as Array<{ id: string; code: string; name: string }>;
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["sig-docs-link"],
    queryFn: async () => {
      const r = await fetch("/api/sig/documents?pageSize=200", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error documentos");
      const json = await r.json();
      return (json.data?.rows ?? json.data?.items ?? json.data ?? []) as Array<{
        id: string;
        code: string;
        title: string;
      }>;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sig-requirement", id],
    queryFn: async () => {
      const r = await fetch(`/api/sig/requirements/${id}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("No se pudo cargar el requisito");
      const json = await r.json();
      return json.data as Detail;
    },
  });

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
        <Link href="/sig/requisitos" className="text-sm text-red-600 hover:underline">
          Volver a la matriz
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>
              {data.standard.code} {data.code} — {data.title}
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant={data.isApplicable ? "success" : "outline"}>
                {data.isApplicable ? "Aplicable" : "No aplicable"}
              </Badge>
              <Badge variant="outline">{data.standard.name}</Badge>
            </div>
            {data.description && <p className="text-sm text-slate-600">{data.description}</p>}
          </CardHeader>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Procesos relacionados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {data.processLinks.map((l) => (
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
              {data.processLinks.length === 0 && <li className="text-slate-500">Sin procesos vinculados</li>}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos relacionados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {data.documentLinks.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <Link href={`/sig/documentos/${l.document.id}`} className="text-red-700 hover:underline">
                    {l.document.code} — {l.document.title}
                  </Link>
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
              {data.documentLinks.length === 0 && <li className="text-slate-500">Sin documentos vinculados</li>}
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
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.evidenceLinks.map((l) => (
                <li key={l.id}>
                  <Link href="/sig/evidencias" className="font-medium text-red-700 hover:underline">
                    {l.evidence.code}
                  </Link>{" "}
                  — {l.evidence.description}
                </li>
              ))}
              {data.evidenceLinks.length === 0 && <li className="text-slate-500">Sin evidencias</li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hallazgos relacionados</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.findingLinks.map((l) => (
                <li key={l.id}>
                  <Link href={`/audits/${l.finding.auditId}`} className="text-red-700 hover:underline">
                    {l.finding.title}
                  </Link>{" "}
                  <Badge variant="outline">{l.finding.findingType}</Badge>{" "}
                  <Badge variant={l.finding.status === "CLOSED" ? "success" : "danger"}>{l.finding.status}</Badge>
                </li>
              ))}
              {data.findingLinks.length === 0 && <li className="text-slate-500">Sin hallazgos</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
