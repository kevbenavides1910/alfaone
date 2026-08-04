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

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type Detail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  kind: "RISK" | "OPPORTUNITY";
  status: string;
  likelihood: number;
  impact: number;
  inherentScore: number;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualScore: number | null;
  inherentLevel: RiskLevel;
  residualLevel: RiskLevel | null;
  treatment: string | null;
  reviewDate: string | null;
  nextReviewDate: string | null;
  reviewOverdue: boolean;
  process: { id: string; code: string; name: string } | null;
  processLinks: Array<{ process: { id: string; code: string; name: string } }>;
  controlLinks: Array<{ control: { id: string; code: string; title: string; status: string } }>;
  requirementLinks: Array<{
    requirement: { id: string; code: string; title: string; standard: { code: string } };
  }>;
  evidenceLinks: Array<{
    evidence: { id: string; code: string; description: string; evidenceDate: string; status: string };
  }>;
};

const LEVEL_STYLE: Record<RiskLevel, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-emerald-100 text-emerald-800",
};

const STATUSES = ["IDENTIFIED", "ANALYZED", "TREATING", "MONITORING", "CLOSED"] as const;

export default function SigRiskDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [controlId, setControlId] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [edit, setEdit] = useState({
    status: "",
    likelihood: "",
    impact: "",
    residualLikelihood: "",
    residualImpact: "",
    treatment: "",
    nextReviewDate: "",
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

  const { data: requirements = [] } = useQuery({
    queryKey: ["sig-requirements-picker"],
    queryFn: async () => {
      const r = await fetch("/api/sig/requirements?applicable=1", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error requisitos");
      const json = await r.json();
      return json.data as Array<{ id: string; code: string; title: string; standard: { code: string } }>;
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
    queryKey: ["sig-risk", id],
    queryFn: async () => {
      const r = await fetch(`/api/sig/risks/${id}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Riesgo no encontrado");
      const json = await r.json();
      return json.data as Detail;
    },
  });

  useEffect(() => {
    if (!data) return;
    setEdit({
      status: data.status,
      likelihood: String(data.likelihood),
      impact: String(data.impact),
      residualLikelihood: data.residualLikelihood != null ? String(data.residualLikelihood) : "",
      residualImpact: data.residualImpact != null ? String(data.residualImpact) : "",
      treatment: data.treatment ?? "",
      nextReviewDate: data.nextReviewDate ? data.nextReviewDate.slice(0, 10) : "",
    });
  }, [data]);

  async function link(body: Record<string, string>, action?: string) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/sig/risks/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, action }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo vincular");
      await qc.invalidateQueries({ queryKey: ["sig-risk", id] });
      await qc.invalidateQueries({ queryKey: ["sig-risks"] });
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
      const r = await fetch(`/api/sig/risks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: edit.status,
          likelihood: Number(edit.likelihood),
          impact: Number(edit.impact),
          residualLikelihood: edit.residualLikelihood ? Number(edit.residualLikelihood) : null,
          residualImpact: edit.residualImpact ? Number(edit.residualImpact) : null,
          treatment: edit.treatment || null,
          nextReviewDate: edit.nextReviewDate || null,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo guardar");
      await qc.invalidateQueries({ queryKey: ["sig-risk", id] });
      await qc.invalidateQueries({ queryKey: ["sig-risks"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <Topbar title="Riesgo SIG" />
        <div className="p-6 text-slate-500">{isLoading ? "Cargando..." : "No encontrado"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title={data.code} />
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <Link href="/sig/riesgos" className="text-sm text-red-600 hover:underline">
          Volver a riesgos
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>
              {data.code} — {data.title}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{data.kind === "OPPORTUNITY" ? "Oportunidad" : "Riesgo"}</Badge>
              <Badge variant="outline">{data.status}</Badge>
              <span className={`rounded px-2 py-0.5 text-xs ${LEVEL_STYLE[data.inherentLevel]}`}>
                Inherente {data.inherentScore} ({data.inherentLevel})
              </span>
              {data.residualLevel && data.residualScore != null && (
                <span className={`rounded px-2 py-0.5 text-xs ${LEVEL_STYLE[data.residualLevel]}`}>
                  Residual {data.residualScore} ({data.residualLevel})
                </span>
              )}
              {data.reviewOverdue && <Badge variant="danger">Revisión vencida</Badge>}
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
            <CardTitle className="text-base">Evaluación y tratamiento</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onSave}>
              <div className="space-y-1">
                <Label>Estado</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={edit.status}
                  onChange={(e) => setEdit((f) => ({ ...f, status: e.target.value }))}
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
                <Label>Probabilidad inherente</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={edit.likelihood}
                  onChange={(e) => setEdit((f) => ({ ...f, likelihood: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Impacto inherente</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={edit.impact}
                  onChange={(e) => setEdit((f) => ({ ...f, impact: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Probabilidad residual</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={edit.residualLikelihood}
                  onChange={(e) => setEdit((f) => ({ ...f, residualLikelihood: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Impacto residual</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={edit.residualImpact}
                  onChange={(e) => setEdit((f) => ({ ...f, residualImpact: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Tratamiento</Label>
                <Textarea
                  rows={3}
                  value={edit.treatment}
                  onChange={(e) => setEdit((f) => ({ ...f, treatment: e.target.value }))}
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
            <CardTitle className="text-base">Controles vinculados</CardTitle>
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
            <CardTitle className="text-base">Requisitos</CardTitle>
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
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!requirementId) return;
                void link({ requirementId }).then(() => setRequirementId(""));
              }}
            >
              <select
                className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
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
            <CardTitle className="text-base">Evidencias</CardTitle>
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
