"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, PlusCircle, XCircle } from "lucide-react";
import type {
  ActionPlanStatus,
  AuditChecklistResult,
  AuditSampleMethod,
  AuditStatus,
  FindingSeverity,
  FindingType,
} from "@prisma/client";
import type { AuditDetail } from "@/modules/sig";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ApiResponse<T> = { data: T; error?: { message: string } };

const auditStatuses: AuditStatus[] = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const severities: FindingSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const findingTypes: FindingType[] = ["NONCONFORMITY", "OBSERVATION", "OPPORTUNITY"];
const actionStatuses: ActionPlanStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const checklistResults: AuditChecklistResult[] = ["PENDING", "COMPLIES", "NON_COMPLIES", "NOT_APPLICABLE"];
const sampleMethods: AuditSampleMethod[] = ["RANDOM", "RISK_BASED", "AUDITOR_JUDGMENT", "MIXED"];

function formatDate(value?: string | Date | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CR", { dateStyle: "medium" }).format(new Date(value));
}

function emptyPlan() {
  return {
    title: "",
    description: "",
    correctionImmediate: "",
    responsibleName: "",
    dueDate: "",
    status: "PENDING" as ActionPlanStatus,
  };
}

function emptyFollowUp() {
  return { note: "", status: "IN_PROGRESS" as ActionPlanStatus, followUpDate: "" };
}

function emptyChecklistItem() {
  return { stage: "", requirement: "", result: "PENDING" as AuditChecklistResult, notes: "", evidence: "" };
}

function emptyFinding() {
  return {
    title: "",
    description: "",
    findingType: "NONCONFORMITY" as FindingType,
    severity: "MEDIUM" as FindingSeverity,
    criterionText: "",
    evidenceStatement: "",
    nonconformityStatement: "",
    rootCause: "",
  };
}

function checklistLabel(result: AuditChecklistResult) {
  const labels: Record<AuditChecklistResult, string> = {
    PENDING: "Pendiente",
    COMPLIES: "Cumple",
    NON_COMPLIES: "No cumple",
    NOT_APPLICABLE: "No aplica",
  };
  return labels[result];
}

function findingTypeLabel(type: FindingType) {
  return { NONCONFORMITY: "No conformidad", OBSERVATION: "Observación", OPPORTUNITY: "Oportunidad" }[type];
}

export function AuditDetailClient({ auditId }: { auditId: string }) {
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState(emptyFinding());
  const [plans, setPlans] = useState<Record<string, ReturnType<typeof emptyPlan>>>({});
  const [followUps, setFollowUps] = useState<Record<string, ReturnType<typeof emptyFollowUp>>>({});
  const [rootCauses, setRootCauses] = useState<Record<string, string>>({});
  const [checklistDrafts, setChecklistDrafts] = useState<
    Record<string, { result: AuditChecklistResult; notes: string; evidence: string }>
  >({});
  const [newChecklistItem, setNewChecklistItem] = useState(emptyChecklistItem());
  const [sampleDraft, setSampleDraft] = useState({
    populationDescription: "",
    populationSize: "",
    sampleSize: "",
    method: "AUDITOR_JUDGMENT" as AuditSampleMethod,
    itemsText: "",
    notes: "",
  });
  const [evidenceUploads, setEvidenceUploads] = useState<Record<string, File | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sig/audits/${auditId}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<AuditDetail>;
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudo cargar la auditoría");
      setAudit(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando auditoría");
    } finally {
      setLoading(false);
    }
  }, [auditId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postJson(path: string, body: unknown, key: string, method: "POST" | "PATCH" = "POST") {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudo guardar");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando cambios");
    } finally {
      setSaving(null);
    }
  }

  async function updateAuditStatus(status: AuditStatus) {
    await postJson(`/api/sig/audits/${auditId}`, { status }, "audit-status", "PATCH");
  }

  async function createFinding(event: FormEvent) {
    event.preventDefault();
    await postJson(`/api/sig/audits/${auditId}/findings`, finding, "finding");
    setFinding(emptyFinding());
  }

  async function createPlan(event: FormEvent, findingId: string) {
    event.preventDefault();
    const plan = plans[findingId] ?? emptyPlan();
    await postJson(`/api/sig/audits/findings/${findingId}/action-plans`, plan, `plan-${findingId}`);
    setPlans((prev) => ({ ...prev, [findingId]: emptyPlan() }));
  }

  async function createFollowUp(event: FormEvent, actionPlanId: string) {
    event.preventDefault();
    const followUp = followUps[actionPlanId] ?? emptyFollowUp();
    await postJson(
      `/api/sig/audits/action-plans/${actionPlanId}/follow-ups`,
      followUp,
      `follow-${actionPlanId}`
    );
    setFollowUps((prev) => ({ ...prev, [actionPlanId]: emptyFollowUp() }));
  }

  async function updateChecklistItem(itemId: string) {
    const draft = checklistDrafts[itemId];
    if (!draft) return;
    await postJson(`/api/sig/audits/checklist/${itemId}`, draft, `checklist-${itemId}`, "PATCH");
  }

  async function createChecklistItem(event: FormEvent) {
    event.preventDefault();
    await postJson(`/api/sig/audits/${auditId}/checklist`, newChecklistItem, "checklist-new");
    setNewChecklistItem(emptyChecklistItem());
  }

  async function generateFindingFromChecklist(itemId: string) {
    await postJson(`/api/sig/audits/checklist/${itemId}/finding`, {}, `gen-finding-${itemId}`);
  }

  async function saveRootCause(findingId: string) {
    await postJson(
      `/api/sig/audits/findings/${findingId}`,
      { rootCause: rootCauses[findingId] ?? "" },
      `root-${findingId}`,
      "PATCH"
    );
  }

  async function closeFinding(findingId: string) {
    await postJson(`/api/sig/audits/findings/${findingId}`, { status: "CLOSED" }, `close-${findingId}`, "PATCH");
  }

  async function completePlan(planId: string) {
    await postJson(`/api/sig/audits/action-plans/${planId}`, { status: "COMPLETED" }, `complete-${planId}`, "PATCH");
  }

  async function verifyEfficacy(planId: string, efficacyStatus: "VERIFIED" | "NOT_EFFECTIVE") {
    await postJson(
      `/api/sig/audits/action-plans/${planId}/efficacy`,
      { efficacyStatus, efficacyNotes: "Verificación desde detalle de auditoría" },
      `efficacy-${planId}`
    );
  }

  async function createSample(event: FormEvent) {
    event.preventDefault();
    const items = sampleDraft.itemsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [code, ...rest] = line.split("|");
        if (rest.length) return { code: code.trim(), label: rest.join("|").trim() };
        return { label: code.trim() };
      });
    await postJson(
      `/api/sig/audits/${auditId}/samples`,
      {
        populationDescription: sampleDraft.populationDescription,
        populationSize: sampleDraft.populationSize ? Number(sampleDraft.populationSize) : null,
        sampleSize: sampleDraft.sampleSize ? Number(sampleDraft.sampleSize) : items.length || null,
        method: sampleDraft.method,
        notes: sampleDraft.notes || null,
        items,
      },
      "sample"
    );
    setSampleDraft({
      populationDescription: "",
      populationSize: "",
      sampleSize: "",
      method: "AUDITOR_JUDGMENT",
      itemsText: "",
      notes: "",
    });
  }

  async function uploadEvidence(params: {
    key: string;
    description: string;
    checklistItemId?: string;
    findingId?: string;
    actionPlanId?: string;
    actionPlanRole?: "OBSERVED" | "IMPLEMENTATION" | "EFFICACY";
  }) {
    const file = evidenceUploads[params.key];
    if (!file) {
      setError("Seleccione un archivo de evidencia");
      return;
    }
    setSaving(params.key);
    setError(null);
    try {
      const form = new FormData();
      form.set("description", params.description);
      form.set("evidenceDate", new Date().toISOString().slice(0, 10));
      form.set("type", "OTHER");
      form.set("auditId", auditId);
      if (params.checklistItemId) form.set("checklistItemId", params.checklistItemId);
      if (params.findingId) form.set("findingId", params.findingId);
      if (params.actionPlanId) form.set("actionPlanId", params.actionPlanId);
      if (params.actionPlanRole) form.set("actionPlanRole", params.actionPlanRole);
      form.set("file", file);
      const res = await fetch("/api/sig/evidences", { method: "POST", body: form });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudo subir la evidencia");
      setEvidenceUploads((prev) => ({ ...prev, [params.key]: null }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error subiendo evidencia");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando auditoría...
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? "Auditoría no encontrada"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/sig/auditorias" className="text-sm text-red-600 hover:underline">
            Volver al dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{audit.procedure.title}</h1>
          <p className="text-sm text-slate-500">
            {audit.procedure.code} · Trimestre {audit.quarter} / {audit.year} · {formatDate(audit.scheduledDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={audit.status}
            disabled={saving === "audit-status"}
            onChange={(e) => void updateAuditStatus(e.target.value as AuditStatus)}
          >
            {auditStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Tipo documental</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{audit.procedure.documentType.name}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Proceso</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{audit.procedure.process?.name ?? "Sin proceso"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Versión vigente</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {audit.procedure.currentVersion?.versionLabel ?? "Sin versión vigente"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Muestreo</CardTitle>
          <p className="text-sm text-slate-500">Documente población, método y unidades verificadas (ISO 19011).</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {audit.samples.map((sample) => (
            <div key={sample.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="font-medium">{sample.populationDescription}</div>
              <div className="mt-1 text-slate-500">
                Método: {sample.method} · Población: {sample.populationSize ?? "—"} · Muestra:{" "}
                {sample.sampleSize ?? sample.items.length}
              </div>
              {sample.items.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-slate-600">
                  {sample.items.map((item) => (
                    <li key={item.id}>
                      {item.code ? `${item.code} — ` : ""}
                      {item.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <form onSubmit={createSample} className="grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label>Descripción de la población</Label>
              <Textarea
                value={sampleDraft.populationDescription}
                onChange={(e) => setSampleDraft((p) => ({ ...p, populationDescription: e.target.value }))}
                required
              />
            </div>
            <Input
              type="number"
              placeholder="Tamaño población"
              value={sampleDraft.populationSize}
              onChange={(e) => setSampleDraft((p) => ({ ...p, populationSize: e.target.value }))}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={sampleDraft.method}
              onChange={(e) => setSampleDraft((p) => ({ ...p, method: e.target.value as AuditSampleMethod }))}
            >
              {sampleMethods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Textarea
              className="md:col-span-2"
              placeholder={"Ítems verificados (uno por línea). Formato: código|etiqueta o solo etiqueta"}
              value={sampleDraft.itemsText}
              onChange={(e) => setSampleDraft((p) => ({ ...p, itemsText: e.target.value }))}
            />
            <Button disabled={saving === "sample"}>
              {saving === "sample" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Registrar muestra
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de chequeo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Etapa / Criterio</th>
                  <th className="px-3 py-2">Resultado</th>
                  <th className="px-3 py-2">Notas / Evidencia texto</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {audit.checklistItems.map((item) => {
                  const draft = checklistDrafts[item.id] ?? {
                    result: item.result,
                    notes: item.notes ?? "",
                    evidence: item.evidence ?? "",
                  };
                  return (
                    <tr key={item.id} className="border-t align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{item.stage}</div>
                        {item.sigRequirement && (
                          <div className="mt-1 text-xs text-red-700">
                            {item.sigRequirement.standard.code} {item.sigRequirement.code} — {item.sigRequirement.title}
                          </div>
                        )}
                        {item.requirement && <div className="mt-1 text-xs text-slate-500">{item.requirement}</div>}
                        {item.evidenceLinks.length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-slate-600">
                            {item.evidenceLinks.map((link) => (
                              <div key={link.id}>
                                {link.evidence.code}: {link.evidence.description.slice(0, 80)}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={draft.result}
                          onChange={(e) =>
                            setChecklistDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, result: e.target.value as AuditChecklistResult },
                            }))
                          }
                        >
                          {checklistResults.map((result) => (
                            <option key={result} value={result}>
                              {checklistLabel(result)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 space-y-2">
                        <Input
                          value={draft.notes}
                          placeholder="Observación"
                          onChange={(e) =>
                            setChecklistDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, notes: e.target.value },
                            }))
                          }
                        />
                        <Input
                          value={draft.evidence}
                          placeholder="Evidencia observada (texto)"
                          onChange={(e) =>
                            setChecklistDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, evidence: e.target.value },
                            }))
                          }
                        />
                        <Input
                          type="file"
                          onChange={(e) =>
                            setEvidenceUploads((prev) => ({
                              ...prev,
                              [`check-${item.id}`]: e.target.files?.[0] ?? null,
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-3 text-right space-y-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={draft.result === "NON_COMPLIES" ? "destructive" : "outline"}
                          disabled={saving === `checklist-${item.id}`}
                          onClick={() => void updateChecklistItem(item.id)}
                        >
                          {draft.result === "COMPLIES" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : draft.result === "NON_COMPLIES" ? (
                            <XCircle className="h-4 w-4" />
                          ) : null}
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={saving === `check-${item.id}`}
                          onClick={() =>
                            void uploadEvidence({
                              key: `check-${item.id}`,
                              description: `Evidencia checklist: ${item.stage}`,
                              checklistItemId: item.id,
                            })
                          }
                        >
                          Adjuntar
                        </Button>
                        {item.result === "NON_COMPLIES" && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={saving === `gen-finding-${item.id}`}
                            onClick={() => void generateFindingFromChecklist(item.id)}
                          >
                            Generar NC
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <form onSubmit={createChecklistItem} className="rounded-lg bg-slate-50 p-3">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <Input
                placeholder="Nueva etapa a revisar"
                value={newChecklistItem.stage}
                onChange={(e) => setNewChecklistItem((prev) => ({ ...prev, stage: e.target.value }))}
                required
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={newChecklistItem.result}
                onChange={(e) =>
                  setNewChecklistItem((prev) => ({ ...prev, result: e.target.value as AuditChecklistResult }))
                }
              >
                {checklistResults.map((result) => (
                  <option key={result} value={result}>
                    {checklistLabel(result)}
                  </option>
                ))}
              </select>
              <Button disabled={saving === "checklist-new"}>
                {saving === "checklist-new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                Agregar etapa
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar hallazgo (ISO 19011)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createFinding} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input
                value={finding.title}
                onChange={(e) => setFinding((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={finding.findingType}
                  onChange={(e) => setFinding((prev) => ({ ...prev, findingType: e.target.value as FindingType }))}
                >
                  {findingTypes.map((type) => (
                    <option key={type} value={type}>
                      {findingTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Severidad</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={finding.severity}
                  onChange={(e) => setFinding((prev) => ({ ...prev, severity: e.target.value as FindingSeverity }))}
                >
                  {severities.map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Criterio</Label>
              <Textarea
                value={finding.criterionText}
                onChange={(e) => setFinding((prev) => ({ ...prev, criterionText: e.target.value }))}
                placeholder="Norma / procedimiento / requisito"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Evidencia observada</Label>
              <Textarea
                value={finding.evidenceStatement}
                onChange={(e) => setFinding((prev) => ({ ...prev, evidenceStatement: e.target.value }))}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Declaración de no conformidad / hallazgo</Label>
              <Textarea
                value={finding.nonconformityStatement}
                onChange={(e) => setFinding((prev) => ({ ...prev, nonconformityStatement: e.target.value }))}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Descripción</Label>
              <Textarea
                value={finding.description}
                onChange={(e) => setFinding((prev) => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>
            <Button disabled={saving === "finding"}>
              {saving === "finding" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Agregar hallazgo
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {audit.findings.map((item) => (
          <Card key={item.id} className="border-slate-200">
            <CardHeader>
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                  {item.criterionText && (
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-semibold">Criterio:</span> {item.criterionText}
                    </p>
                  )}
                  {item.evidenceStatement && (
                    <p className="mt-1 text-xs text-slate-600">
                      <span className="font-semibold">Evidencia:</span> {item.evidenceStatement}
                    </p>
                  )}
                  {item.nonconformityStatement && (
                    <p className="mt-1 text-xs text-slate-600">
                      <span className="font-semibold">Declaración:</span> {item.nonconformityStatement}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{findingTypeLabel(item.findingType)}</Badge>
                  <Badge variant={item.severity === "CRITICAL" || item.severity === "HIGH" ? "danger" : "warning"}>
                    {item.severity}
                  </Badge>
                  <Badge variant={item.status === "CLOSED" ? "success" : "outline"}>{item.status}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-amber-50 p-3 space-y-2">
                <Label>Análisis de causa</Label>
                <Textarea
                  value={rootCauses[item.id] ?? item.rootCause ?? ""}
                  onChange={(e) => setRootCauses((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="Causa raíz del hallazgo"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving === `root-${item.id}`}
                    onClick={() => void saveRootCause(item.id)}
                  >
                    Guardar causa
                  </Button>
                  {item.status !== "CLOSED" && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving === `close-${item.id}`}
                      onClick={() => void closeFinding(item.id)}
                    >
                      Cerrar hallazgo
                    </Button>
                  )}
                </div>
              </div>

              <form onSubmit={(event) => void createPlan(event, item.id)} className="rounded-lg bg-slate-50 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder="Título del plan"
                    value={(plans[item.id] ?? emptyPlan()).title}
                    onChange={(e) =>
                      setPlans((prev) => ({
                        ...prev,
                        [item.id]: { ...(prev[item.id] ?? emptyPlan()), title: e.target.value },
                      }))
                    }
                    required
                  />
                  <Input
                    placeholder="Responsable"
                    value={(plans[item.id] ?? emptyPlan()).responsibleName}
                    onChange={(e) =>
                      setPlans((prev) => ({
                        ...prev,
                        [item.id]: { ...(prev[item.id] ?? emptyPlan()), responsibleName: e.target.value },
                      }))
                    }
                  />
                  <Input
                    type="date"
                    value={(plans[item.id] ?? emptyPlan()).dueDate}
                    onChange={(e) =>
                      setPlans((prev) => ({
                        ...prev,
                        [item.id]: { ...(prev[item.id] ?? emptyPlan()), dueDate: e.target.value },
                      }))
                    }
                  />
                  <Button disabled={saving === `plan-${item.id}`}>
                    {saving === `plan-${item.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                    Agregar plan
                  </Button>
                  <Textarea
                    className="md:col-span-2"
                    placeholder="Corrección inmediata"
                    value={(plans[item.id] ?? emptyPlan()).correctionImmediate}
                    onChange={(e) =>
                      setPlans((prev) => ({
                        ...prev,
                        [item.id]: { ...(prev[item.id] ?? emptyPlan()), correctionImmediate: e.target.value },
                      }))
                    }
                  />
                  <Textarea
                    className="md:col-span-2"
                    placeholder="Descripción de la acción correctiva"
                    value={(plans[item.id] ?? emptyPlan()).description}
                    onChange={(e) =>
                      setPlans((prev) => ({
                        ...prev,
                        [item.id]: { ...(prev[item.id] ?? emptyPlan()), description: e.target.value },
                      }))
                    }
                    required
                  />
                </div>
              </form>

              {item.actionPlans.map((plan) => (
                <div key={plan.id} className="rounded-lg border border-slate-200 p-3 space-y-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{plan.title}</div>
                      <div className="text-sm text-slate-500">{plan.description}</div>
                      {plan.correctionImmediate && (
                        <div className="mt-1 text-xs text-slate-500">
                          Corrección inmediata: {plan.correctionImmediate}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-slate-400">
                        Responsable: {plan.responsibleName ?? "No asignado"} · Vence: {formatDate(plan.dueDate)} ·
                        Eficacia: {plan.efficacyStatus}
                      </div>
                      {plan.evidenceLinks.length > 0 && (
                        <div className="mt-2 text-xs text-slate-600">
                          Evidencias:{" "}
                          {plan.evidenceLinks
                            .map((l) => `${l.evidence.code} (${l.role})`)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                    <Badge variant={plan.status === "COMPLETED" ? "success" : "outline"}>{plan.status}</Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="file"
                      className="max-w-xs"
                      onChange={(e) =>
                        setEvidenceUploads((prev) => ({
                          ...prev,
                          [`plan-${plan.id}`]: e.target.files?.[0] ?? null,
                        }))
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving === `plan-${plan.id}`}
                      onClick={() =>
                        void uploadEvidence({
                          key: `plan-${plan.id}`,
                          description: `Evidencia implementación: ${plan.title}`,
                          actionPlanId: plan.id,
                          actionPlanRole: "IMPLEMENTATION",
                          findingId: item.id,
                        })
                      }
                    >
                      Evidencia implementación
                    </Button>
                    {plan.status !== "COMPLETED" && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving === `complete-${plan.id}`}
                        onClick={() => void completePlan(plan.id)}
                      >
                        Completar plan
                      </Button>
                    )}
                    {plan.efficacyStatus !== "VERIFIED" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={saving === `efficacy-${plan.id}`}
                        onClick={() => void verifyEfficacy(plan.id, "VERIFIED")}
                      >
                        Verificar eficacia
                      </Button>
                    )}
                  </div>

                  <form
                    onSubmit={(event) => void createFollowUp(event, plan.id)}
                    className="grid gap-2 md:grid-cols-[1fr_180px_160px_auto]"
                  >
                    <Input
                      placeholder="Nota de seguimiento"
                      value={(followUps[plan.id] ?? emptyFollowUp()).note}
                      onChange={(e) =>
                        setFollowUps((prev) => ({
                          ...prev,
                          [plan.id]: { ...(prev[plan.id] ?? emptyFollowUp()), note: e.target.value },
                        }))
                      }
                      required
                    />
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={(followUps[plan.id] ?? emptyFollowUp()).status}
                      onChange={(e) =>
                        setFollowUps((prev) => ({
                          ...prev,
                          [plan.id]: {
                            ...(prev[plan.id] ?? emptyFollowUp()),
                            status: e.target.value as ActionPlanStatus,
                          },
                        }))
                      }
                    >
                      {actionStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="date"
                      value={(followUps[plan.id] ?? emptyFollowUp()).followUpDate}
                      onChange={(e) =>
                        setFollowUps((prev) => ({
                          ...prev,
                          [plan.id]: { ...(prev[plan.id] ?? emptyFollowUp()), followUpDate: e.target.value },
                        }))
                      }
                    />
                    <Button variant="outline" disabled={saving === `follow-${plan.id}`}>
                      {saving === `follow-${plan.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
                    </Button>
                  </form>

                  {plan.followUps.length > 0 && (
                    <div className="space-y-2 border-t pt-3">
                      {plan.followUps.map((followUp) => (
                        <div key={followUp.id} className="text-sm">
                          <span className="font-medium">{formatDate(followUp.followUpDate)}:</span>{" "}
                          <span className="text-slate-600">{followUp.note}</span>{" "}
                          <Badge variant="outline" className="ml-2">
                            {followUp.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {audit.findings.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-500">
              Esta auditoría aún no tiene hallazgos registrados.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
