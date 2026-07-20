"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, PlusCircle, XCircle } from "lucide-react";
import type { ActionPlanStatus, AuditChecklistResult, AuditStatus, FindingSeverity } from "@prisma/client";
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
const actionStatuses: ActionPlanStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const checklistResults: AuditChecklistResult[] = ["PENDING", "COMPLIES", "NON_COMPLIES", "NOT_APPLICABLE"];

function formatDate(value?: string | Date | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CR", { dateStyle: "medium" }).format(new Date(value));
}

function emptyPlan() {
  return { title: "", description: "", responsibleName: "", dueDate: "", status: "PENDING" as ActionPlanStatus };
}

function emptyFollowUp() {
  return { note: "", status: "IN_PROGRESS" as ActionPlanStatus, followUpDate: "" };
}

function emptyChecklistItem() {
  return { stage: "", requirement: "", result: "PENDING" as AuditChecklistResult, notes: "", evidence: "" };
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

export function AuditDetailClient({ auditId }: { auditId: string }) {
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState({ title: "", description: "", severity: "MEDIUM" as FindingSeverity });
  const [plans, setPlans] = useState<Record<string, ReturnType<typeof emptyPlan>>>({});
  const [followUps, setFollowUps] = useState<Record<string, ReturnType<typeof emptyFollowUp>>>({});
  const [checklistDrafts, setChecklistDrafts] = useState<Record<string, { result: AuditChecklistResult; notes: string; evidence: string }>>({});
  const [newChecklistItem, setNewChecklistItem] = useState(emptyChecklistItem());

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

  async function submit(path: string, body: unknown, key: string) {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch(path, {
        method: path.includes("/follow-ups/") || path.includes("/findings/") || path.includes("/action-plans/")
          ? "POST"
          : "PATCH",
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
    setSaving("audit-status");
    setError(null);
    try {
      const res = await fetch(`/api/sig/audits/${auditId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as ApiResponse<AuditDetail>;
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudo actualizar el estado");
      setAudit(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando estado");
    } finally {
      setSaving(null);
    }
  }

  async function createFinding(event: FormEvent) {
    event.preventDefault();
    await submit(`/api/sig/audits/${auditId}/findings`, finding, "finding");
    setFinding({ title: "", description: "", severity: "MEDIUM" });
  }

  async function createPlan(event: FormEvent, findingId: string) {
    event.preventDefault();
    const plan = plans[findingId] ?? emptyPlan();
    await submit(`/api/sig/audits/findings/${findingId}/action-plans`, plan, `plan-${findingId}`);
    setPlans((prev) => ({ ...prev, [findingId]: emptyPlan() }));
  }

  async function createFollowUp(event: FormEvent, actionPlanId: string) {
    event.preventDefault();
    const followUp = followUps[actionPlanId] ?? emptyFollowUp();
    await submit(`/api/sig/audits/action-plans/${actionPlanId}/follow-ups`, followUp, `follow-${actionPlanId}`);
    setFollowUps((prev) => ({ ...prev, [actionPlanId]: emptyFollowUp() }));
  }

  async function updateChecklistItem(itemId: string) {
    const draft = checklistDrafts[itemId];
    if (!draft) return;
    setSaving(`checklist-${itemId}`);
    setError(null);
    try {
      const res = await fetch(`/api/sig/audits/checklist/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudo actualizar el checklist");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando checklist");
    } finally {
      setSaving(null);
    }
  }

  async function createChecklistItem(event: FormEvent) {
    event.preventDefault();
    setSaving("checklist-new");
    setError(null);
    try {
      const res = await fetch(`/api/sig/audits/${auditId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newChecklistItem),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudo agregar la etapa");
      setNewChecklistItem(emptyChecklistItem());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error agregando etapa");
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
          {saving === "audit-status" && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
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
          <CardTitle>Lista de chequeo del procedimiento</CardTitle>
          <p className="text-sm text-slate-500">
            Marque cada etapa revisada como cumple, no cumple, no aplica o pendiente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Etapa</th>
                  <th className="px-3 py-2">Resultado</th>
                  <th className="px-3 py-2">Notas</th>
                  <th className="px-3 py-2">Evidencia</th>
                  <th className="px-3 py-2 text-right">Acción</th>
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
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{item.stage}</div>
                        {item.requirement && <div className="mt-1 text-xs text-slate-500">{item.requirement}</div>}
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
                      <td className="px-3 py-3">
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
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          value={draft.evidence}
                          placeholder="Evidencia o referencia"
                          onChange={(e) =>
                            setChecklistDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, evidence: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={draft.result === "NON_COMPLIES" ? "destructive" : "outline"}
                          disabled={saving === `checklist-${item.id}`}
                          onClick={() => void updateChecklistItem(item.id)}
                        >
                          {saving === `checklist-${item.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : draft.result === "COMPLIES" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : draft.result === "NON_COMPLIES" ? (
                            <XCircle className="h-4 w-4" />
                          ) : null}
                          Guardar
                        </Button>
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
              <Textarea
                className="md:col-span-3"
                placeholder="Criterio o requisito esperado para esta etapa"
                value={newChecklistItem.requirement}
                onChange={(e) => setNewChecklistItem((prev) => ({ ...prev, requirement: e.target.value }))}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar hallazgo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createFinding} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input
                value={finding.title}
                onChange={(e) => setFinding((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
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
            <div className="flex items-end">
              <Button disabled={saving === "finding"}>
                {saving === "finding" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                Agregar
              </Button>
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label>Descripción</Label>
              <Textarea
                value={finding.description}
                onChange={(e) => setFinding((prev) => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>
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
                </div>
                <div className="flex gap-2">
                  <Badge variant={item.severity === "CRITICAL" || item.severity === "HIGH" ? "danger" : "warning"}>
                    {item.severity}
                  </Badge>
                  <Badge variant={item.status === "CLOSED" ? "success" : "outline"}>{item.status}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={(event) => void createPlan(event, item.id)} className="rounded-lg bg-slate-50 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder="Título del plan"
                    value={(plans[item.id] ?? emptyPlan()).title}
                    onChange={(e) =>
                      setPlans((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? emptyPlan()), title: e.target.value } }))
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
                      setPlans((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? emptyPlan()), dueDate: e.target.value } }))
                    }
                  />
                  <Button disabled={saving === `plan-${item.id}`}>
                    {saving === `plan-${item.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                    Agregar plan
                  </Button>
                  <Textarea
                    className="md:col-span-2"
                    placeholder="Descripción del plan de acción"
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
                <div key={plan.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{plan.title}</div>
                      <div className="text-sm text-slate-500">{plan.description}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Responsable: {plan.responsibleName ?? "No asignado"} · Vence: {formatDate(plan.dueDate)}
                      </div>
                    </div>
                    <Badge variant={plan.status === "COMPLETED" ? "success" : "outline"}>{plan.status}</Badge>
                  </div>

                  <form onSubmit={(event) => void createFollowUp(event, plan.id)} className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_160px_auto]">
                    <Input
                      placeholder="Nota de seguimiento"
                      value={(followUps[plan.id] ?? emptyFollowUp()).note}
                      onChange={(e) =>
                        setFollowUps((prev) => ({ ...prev, [plan.id]: { ...(prev[plan.id] ?? emptyFollowUp()), note: e.target.value } }))
                      }
                      required
                    />
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={(followUps[plan.id] ?? emptyFollowUp()).status}
                      onChange={(e) =>
                        setFollowUps((prev) => ({
                          ...prev,
                          [plan.id]: { ...(prev[plan.id] ?? emptyFollowUp()), status: e.target.value as ActionPlanStatus },
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
                    <div className="mt-3 space-y-2 border-t pt-3">
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
