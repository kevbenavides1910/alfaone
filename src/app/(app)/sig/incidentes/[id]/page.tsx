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

type Detail = {
  id: string;
  code: string;
  title: string;
  description: string;
  type: string;
  severity: string;
  status: string;
  occurredAt: string;
  location: string | null;
  humanRightsImpact: boolean;
  notificationRequired: boolean;
  notifiedAt: string | null;
  involvedParties: string | null;
  immediateActions: string | null;
  rootCause: string | null;
  correctiveActions: string | null;
  closureNotes: string | null;
  trafficLight: TrafficLight;
  process: { id: string; code: string; name: string } | null;
  controlLinks: Array<{ control: { id: string; code: string; title: string } }>;
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
  "REPORTED",
  "UNDER_INVESTIGATION",
  "ACTIONS_PENDING",
  "CLOSED",
  "DISMISSED",
] as const;

export default function SigIncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [controlId, setControlId] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [edit, setEdit] = useState({
    status: "",
    severity: "",
    rootCause: "",
    correctiveActions: "",
    involvedParties: "",
    closureNotes: "",
    notifiedAt: "",
    humanRightsImpact: false,
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
    queryKey: ["sig-incident", id],
    queryFn: async () => {
      const r = await fetch(`/api/sig/incidents/${id}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Incidente no encontrado");
      const json = await r.json();
      return json.data as Detail;
    },
  });

  useEffect(() => {
    if (!data) return;
    setEdit({
      status: data.status,
      severity: data.severity,
      rootCause: data.rootCause ?? "",
      correctiveActions: data.correctiveActions ?? "",
      involvedParties: data.involvedParties ?? "",
      closureNotes: data.closureNotes ?? "",
      notifiedAt: data.notifiedAt ? data.notifiedAt.slice(0, 10) : "",
      humanRightsImpact: data.humanRightsImpact,
    });
  }, [data]);

  async function link(body: Record<string, string>, action?: string) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/sig/incidents/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, action }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo vincular");
      await qc.invalidateQueries({ queryKey: ["sig-incident", id] });
      await qc.invalidateQueries({ queryKey: ["sig-incidents"] });
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
      const r = await fetch(`/api/sig/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: edit.status,
          severity: edit.severity,
          rootCause: edit.rootCause || null,
          correctiveActions: edit.correctiveActions || null,
          involvedParties: edit.involvedParties || null,
          closureNotes: edit.closureNotes || null,
          notifiedAt: edit.notifiedAt || null,
          humanRightsImpact: edit.humanRightsImpact,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo guardar");
      await qc.invalidateQueries({ queryKey: ["sig-incident", id] });
      await qc.invalidateQueries({ queryKey: ["sig-incidents"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <Topbar title="Incidente SIG" />
        <div className="p-6 text-slate-500">{isLoading ? "Cargando..." : "No encontrado"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title={data.code} />
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <Link href="/sig/incidentes" className="text-sm text-red-600 hover:underline">
          Volver a incidentes
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>
              {data.code} — {data.title}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{data.type}</Badge>
              <Badge variant="outline">{data.severity}</Badge>
              <Badge variant="outline">{data.status}</Badge>
              <span className={`rounded px-2 py-0.5 text-xs ${LIGHT_STYLE[data.trafficLight]}`}>
                {data.trafficLight}
              </span>
              {data.humanRightsImpact && <Badge variant="danger">DDHH</Badge>}
              {data.process && (
                <Link href={`/sig/procesos/${data.process.id}`}>
                  <Badge variant="outline">
                    {data.process.code} — {data.process.name}
                  </Badge>
                </Link>
              )}
            </div>
            <p className="text-sm text-slate-600">{data.description}</p>
            <p className="text-xs text-slate-500">
              Ocurrido: {formatDate(data.occurredAt)}
              {data.location ? ` · ${data.location}` : ""}
            </p>
            {data.immediateActions && (
              <p className="text-sm text-slate-600">
                <span className="font-medium">Acciones inmediatas:</span> {data.immediateActions}
              </p>
            )}
          </CardHeader>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Investigación y cierre</CardTitle>
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
                <Label>Severidad</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={edit.severity}
                  onChange={(e) => setEdit((f) => ({ ...f, severity: e.target.value }))}
                >
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Fecha de notificación</Label>
                <Input
                  type="date"
                  value={edit.notifiedAt}
                  onChange={(e) => setEdit((f) => ({ ...f, notifiedAt: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm self-end pb-2">
                <input
                  type="checkbox"
                  checked={edit.humanRightsImpact}
                  onChange={(e) => setEdit((f) => ({ ...f, humanRightsImpact: e.target.checked }))}
                />
                Impacto en DDHH
              </label>
              <div className="space-y-1 md:col-span-2">
                <Label>Partes involucradas</Label>
                <Textarea
                  rows={2}
                  value={edit.involvedParties}
                  onChange={(e) => setEdit((f) => ({ ...f, involvedParties: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Causa raíz {edit.humanRightsImpact ? "(requerida para cerrar)" : ""}</Label>
                <Textarea
                  rows={2}
                  value={edit.rootCause}
                  onChange={(e) => setEdit((f) => ({ ...f, rootCause: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Acciones correctivas</Label>
                <Textarea
                  rows={2}
                  value={edit.correctiveActions}
                  onChange={(e) => setEdit((f) => ({ ...f, correctiveActions: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Notas de cierre</Label>
                <Textarea
                  rows={2}
                  value={edit.closureNotes}
                  onChange={(e) => setEdit((f) => ({ ...f, closureNotes: e.target.value }))}
                />
              </div>
              <div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar investigación"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Controles relacionados</CardTitle>
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
