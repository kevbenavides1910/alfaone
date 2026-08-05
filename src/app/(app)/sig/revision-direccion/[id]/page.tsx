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
import { formatDate } from "@/lib/utils/format";

type TrafficLight = "GREEN" | "YELLOW" | "RED" | "GRAY";

const INPUT_LABELS: Record<string, string> = {
  PRIOR_ACTIONS: "a) Acciones de revisiones previas",
  CONTEXT_CHANGES: "b) Cambios en el contexto",
  CUSTOMER_FEEDBACK: "c) Satisfacción del cliente / quejas",
  QUALITY_OBJECTIVES: "d) Objetivos de calidad",
  PROCESS_PERFORMANCE: "e) Desempeño de procesos",
  NONCONFORMITIES_CAPA: "f) No conformidades y CAPA",
  MONITORING_MEASUREMENT: "g) Seguimiento y medición",
  AUDIT_RESULTS: "h) Resultados de auditorías",
  EXTERNAL_PROVIDERS: "i) Proveedores externos",
  RESOURCES: "j) Recursos",
  RISKS_OPPORTUNITIES_EFFICACY: "k) Eficacia riesgos/oportunidades",
  IMPROVEMENT_OPPORTUNITIES: "l) Oportunidades de mejora",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  FOLLOW_UP: "Seguimiento",
  CLOSED: "Cerrada",
};

const LIGHT_STYLE: Record<TrafficLight, string> = {
  GREEN: "bg-emerald-100 text-emerald-800",
  YELLOW: "bg-amber-100 text-amber-800",
  RED: "bg-red-100 text-red-800",
  GRAY: "bg-slate-100 text-slate-600",
};

type Detail = {
  id: string;
  code: string;
  title: string;
  status: string;
  meetingDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  location: string | null;
  attendees: string | null;
  agenda: string | null;
  minutesSummary: string | null;
  outputImprovements: string | null;
  outputQmsChanges: string | null;
  outputResourceNeeds: string | null;
  formCode: string;
  followUpFormCode: string;
  trafficLight: TrafficLight;
  coveredInputs: number;
  totalInputs: number;
  openActions: number;
  overdueActions: number;
  previousReview: { id: string; code: string; title: string } | null;
  inputs: Array<{
    id: string;
    inputKey: string;
    covered: boolean;
    notes: string | null;
    sortOrder: number;
  }>;
  actions: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    dueDate: string | null;
    efficacyNotes: string | null;
    ownerUser: { id: string; name: string } | null;
  }>;
  processLinks: Array<{ process: { id: string; code: string; name: string } }>;
  evidenceLinks: Array<{
    evidence: { id: string; code: string; description: string };
  }>;
};

export default function SigRevisionDireccionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [processId, setProcessId] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [edit, setEdit] = useState({
    status: "",
    title: "",
    meetingDate: "",
    location: "",
    attendees: "",
    agenda: "",
    minutesSummary: "",
    outputImprovements: "",
    outputQmsChanges: "",
    outputResourceNeeds: "",
  });
  const [actionForm, setActionForm] = useState({
    title: "",
    description: "",
    dueDate: "",
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
    queryKey: ["sig-management-review", id],
    queryFn: async () => {
      const r = await fetch(`/api/sig/management-reviews/${id}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Revisión no encontrada");
      const json = await r.json();
      return json.data as Detail;
    },
  });

  useEffect(() => {
    if (!data) return;
    setEdit({
      status: data.status,
      title: data.title,
      meetingDate: data.meetingDate.slice(0, 10),
      location: data.location ?? "",
      attendees: data.attendees ?? "",
      agenda: data.agenda ?? "",
      minutesSummary: data.minutesSummary ?? "",
      outputImprovements: data.outputImprovements ?? "",
      outputQmsChanges: data.outputQmsChanges ?? "",
      outputResourceNeeds: data.outputResourceNeeds ?? "",
    });
  }, [data]);

  async function postAction(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/sig/management-reviews/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "Operación fallida");
      await qc.invalidateQueries({ queryKey: ["sig-management-review", id] });
      await qc.invalidateQueries({ queryKey: ["sig-management-reviews"] });
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
      const r = await fetch(`/api/sig/management-reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: edit.status,
          title: edit.title,
          meetingDate: edit.meetingDate,
          location: edit.location || null,
          attendees: edit.attendees || null,
          agenda: edit.agenda || null,
          minutesSummary: edit.minutesSummary || null,
          outputImprovements: edit.outputImprovements || null,
          outputQmsChanges: edit.outputQmsChanges || null,
          outputResourceNeeds: edit.outputResourceNeeds || null,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo guardar");
      await qc.invalidateQueries({ queryKey: ["sig-management-review", id] });
      await qc.invalidateQueries({ queryKey: ["sig-management-reviews"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <Topbar title="Revisión por la dirección" />
        <div className="p-6 text-slate-500">{isLoading ? "Cargando..." : "No encontrada"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title={data.code} />
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <Link href="/sig/revision-direccion" className="text-sm text-red-600 hover:underline">
          Volver a revisiones
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>
              {data.code} — {data.title}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{STATUS_LABEL[data.status] ?? data.status}</Badge>
              <Badge variant="outline">{data.formCode}</Badge>
              <Badge variant="outline">{data.followUpFormCode}</Badge>
              <span className={`rounded px-2 py-0.5 text-xs ${LIGHT_STYLE[data.trafficLight]}`}>
                {data.trafficLight}
              </span>
              {data.previousReview && (
                <Link href={`/sig/revision-direccion/${data.previousReview.id}`}>
                  <Badge variant="outline">Previa: {data.previousReview.code}</Badge>
                </Link>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Reunión: {formatDate(data.meetingDate)}
              {data.location ? ` · ${data.location}` : ""}
              {data.periodStart || data.periodEnd
                ? ` · Periodo ${data.periodStart ? formatDate(data.periodStart) : "?"} – ${
                    data.periodEnd ? formatDate(data.periodEnd) : "?"
                  }`
                : ""}
            </p>
            <p className="text-sm text-slate-600">
              Entradas cubiertas: {data.coveredInputs}/{data.totalInputs} · Acciones abiertas:{" "}
              {data.openActions}
              {data.overdueActions > 0 ? ` (${data.overdueActions} vencidas)` : ""}
            </p>
          </CardHeader>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acta y salidas (ISO 9.3.3)</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onSave}>
              <div className="space-y-1 md:col-span-2">
                <Label>Título</Label>
                <Input
                  value={edit.title}
                  onChange={(e) => setEdit((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={edit.status}
                  onChange={(e) => setEdit((f) => ({ ...f, status: e.target.value }))}
                >
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Fecha de reunión</Label>
                <Input
                  type="date"
                  value={edit.meetingDate}
                  onChange={(e) => setEdit((f) => ({ ...f, meetingDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Lugar</Label>
                <Input
                  value={edit.location}
                  onChange={(e) => setEdit((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Asistentes</Label>
                <Textarea
                  rows={2}
                  value={edit.attendees}
                  onChange={(e) => setEdit((f) => ({ ...f, attendees: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Agenda</Label>
                <Textarea
                  rows={2}
                  value={edit.agenda}
                  onChange={(e) => setEdit((f) => ({ ...f, agenda: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Resumen del acta *</Label>
                <Textarea
                  rows={4}
                  value={edit.minutesSummary}
                  onChange={(e) => setEdit((f) => ({ ...f, minutesSummary: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Salida: oportunidades de mejora</Label>
                <Textarea
                  rows={2}
                  value={edit.outputImprovements}
                  onChange={(e) => setEdit((f) => ({ ...f, outputImprovements: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Salida: necesidades de cambio del SGC</Label>
                <Textarea
                  rows={2}
                  value={edit.outputQmsChanges}
                  onChange={(e) => setEdit((f) => ({ ...f, outputQmsChanges: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Salida: necesidades de recursos</Label>
                <Textarea
                  rows={2}
                  value={edit.outputResourceNeeds}
                  onChange={(e) => setEdit((f) => ({ ...f, outputResourceNeeds: e.target.value }))}
                />
              </div>
              <div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar acta"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entradas ISO 9.3.2</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.inputs.map((input) => (
              <div key={input.id} className="rounded-md border bg-white p-3">
                <label className="flex items-start gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={input.covered}
                    disabled={saving}
                    onChange={(e) =>
                      void postAction({
                        action: "update-input",
                        inputKey: input.inputKey,
                        covered: e.target.checked,
                      })
                    }
                  />
                  <span>{INPUT_LABELS[input.inputKey] ?? input.inputKey}</span>
                </label>
                <Textarea
                  className="mt-2"
                  rows={2}
                  placeholder="Notas / evidencia referida"
                  defaultValue={input.notes ?? ""}
                  disabled={saving}
                  onBlur={(e) => {
                    const notes = e.target.value.trim();
                    if ((input.notes ?? "") === notes) return;
                    void postAction({
                      action: "update-input",
                      inputKey: input.inputKey,
                      notes: notes || null,
                    });
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones de seguimiento (F-SIG-19)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {data.actions.map((a) => (
                <li key={a.id} className="rounded-md border bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{a.title}</span>
                      {a.dueDate && (
                        <span className="ml-2 text-xs text-slate-500">
                          Vence {formatDate(a.dueDate)}
                        </span>
                      )}
                    </div>
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-xs"
                      value={a.status}
                      disabled={saving}
                      onChange={(e) =>
                        void postAction({
                          action: "update-action",
                          actionId: a.id,
                          status: e.target.value,
                        })
                      }
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                  {a.description && <p className="mt-1 text-slate-600">{a.description}</p>}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={saving}
                    onClick={() =>
                      void postAction({ action: "delete-action", actionId: a.id })
                    }
                  >
                    Eliminar
                  </Button>
                </li>
              ))}
              {data.actions.length === 0 && (
                <li className="text-slate-500">Sin acciones de seguimiento</li>
              )}
            </ul>

            <form
              className="grid gap-2 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!actionForm.title.trim()) return;
                void postAction({
                  action: "create-action",
                  title: actionForm.title,
                  description: actionForm.description || null,
                  dueDate: actionForm.dueDate || null,
                }).then(() => setActionForm({ title: "", description: "", dueDate: "" }));
              }}
            >
              <div className="space-y-1 md:col-span-2">
                <Label>Nueva acción</Label>
                <Input
                  value={actionForm.title}
                  onChange={(e) => setActionForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Título"
                />
              </div>
              <div className="space-y-1">
                <Label>Fecha límite</Label>
                <Input
                  type="date"
                  value={actionForm.dueDate}
                  onChange={(e) => setActionForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Descripción</Label>
                <Input
                  value={actionForm.description}
                  onChange={(e) => setActionForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <Button type="submit" disabled={saving || !actionForm.title.trim()}>
                  Agregar acción
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Procesos relacionados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {data.processLinks.map((l) => (
                <li key={l.process.id} className="flex items-center justify-between gap-2">
                  <Link href={`/sig/procesos/${l.process.id}`} className="text-red-700 hover:underline">
                    {l.process.code} — {l.process.name}
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      void postAction({ action: "unlink", processId: l.process.id })
                    }
                  >
                    Quitar
                  </Button>
                </li>
              ))}
              {data.processLinks.length === 0 && <li className="text-slate-500">Sin procesos</li>}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!processId) return;
                void postAction({ processId }).then(() => setProcessId(""));
              }}
            >
              <select
                className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
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
            <CardTitle className="text-base">Evidencias (acta / anexos)</CardTitle>
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
                    onClick={() =>
                      void postAction({ action: "unlink", evidenceId: l.evidence.id })
                    }
                  >
                    Quitar
                  </Button>
                </li>
              ))}
              {data.evidenceLinks.length === 0 && (
                <li className="text-slate-500">Sin evidencias vinculadas</li>
              )}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!evidenceId) return;
                void postAction({ evidenceId }).then(() => setEvidenceId(""));
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
