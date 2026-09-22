"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProcedureContentData } from "./ProcedureViewer";

export type ProcedureEditForm = {
  objective: string;
  scope: string;
  responsibilities: string;
  definitions: string;
  stages: { clientKey: string; title: string; body: string; responsible: string }[];
  changeSummary: string;
  assignedApproverId: string;
  versionLabel: string;
  changeRequestIds: string[];
};

type Approver = { id: string; name: string; email: string };

type Props = {
  initial: ProcedureContentData;
  approvers: Approver[];
  implementingRequestIds?: string[];
  seedFromRequest?: {
    proposedTitle?: string | null;
    proposedBody?: string | null;
    description?: string;
    type?: string;
    targetStageId?: string | null;
  } | null;
  onCancel: () => void;
  onSave: (form: ProcedureEditForm) => Promise<void>;
  saving?: boolean;
};

function newKey() {
  return `s_${Math.random().toString(36).slice(2, 10)}`;
}

function sectionTitle(number: string | null | undefined, title: string) {
  if (number) return `${number}. ${title}`;
  return title;
}

export function ProcedureEditor({
  initial,
  approvers,
  implementingRequestIds = [],
  seedFromRequest,
  onCancel,
  onSave,
  saving,
}: Props) {
  const seededStages = (() => {
    const fromSections =
      initial.sections && initial.sections.length > 0
        ? initial.sections.map((s) => ({
            clientKey: s.id.startsWith("preview-") ? newKey() : s.id,
            title: sectionTitle(s.number, s.title),
            body: s.body,
            responsible: s.responsible ?? "",
          }))
        : null;

    const base =
      fromSections ??
      (initial.stages.length > 0
        ? initial.stages.map((s) => ({
            clientKey: s.id,
            title: s.title,
            body: s.body,
            responsible: s.responsible ?? "",
          }))
        : [{ clientKey: newKey(), title: "1. Objetivo General", body: "", responsible: "" }]);

    if (!seedFromRequest) return base;
    if (seedFromRequest.type === "ADD_STAGE") {
      return [
        ...base,
        {
          clientKey: newKey(),
          title: seedFromRequest.proposedTitle || "Nueva sección",
          body: seedFromRequest.proposedBody || "",
          responsible: "",
        },
      ];
    }
    if (seedFromRequest.type === "REMOVE_STAGE" && seedFromRequest.targetStageId) {
      const filtered = base.filter((s) => s.clientKey !== seedFromRequest.targetStageId);
      return filtered.length > 0
        ? filtered
        : [{ clientKey: newKey(), title: "1. Objetivo General", body: "", responsible: "" }];
    }
    if (seedFromRequest.targetStageId && seedFromRequest.type === "EDIT_STAGE") {
      return base.map((s) =>
        s.clientKey === seedFromRequest.targetStageId
          ? {
              ...s,
              title: seedFromRequest.proposedTitle || s.title,
              body: seedFromRequest.proposedBody || s.body,
            }
          : s
      );
    }
    return base;
  })();

  const [form, setForm] = useState<ProcedureEditForm>({
    objective: initial.body?.objective ?? "",
    scope: initial.body?.scope ?? "",
    responsibilities: initial.body?.responsibilities ?? "",
    definitions: initial.body?.definitions ?? "",
    stages: seededStages,
    changeSummary: seedFromRequest?.description?.slice(0, 500) ?? "",
    assignedApproverId: "",
    versionLabel: "",
    changeRequestIds: implementingRequestIds,
  });
  const [error, setError] = useState("");

  const updateStage = (key: string, patch: Partial<(typeof form.stages)[0]>) => {
    setForm((f) => ({
      ...f,
      stages: f.stages.map((s) => (s.clientKey === key ? { ...s, ...patch } : s)),
    }));
  };

  const moveStage = (index: number, dir: -1 | 1) => {
    setForm((f) => {
      const next = [...f.stages];
      const j = index + dir;
      if (j < 0 || j >= next.length) return f;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...f, stages: next };
    });
  };

  const handleSave = async () => {
    setError("");
    if (!form.assignedApproverId) {
      setError("Seleccione el aprobador");
      return;
    }
    if (!form.changeSummary.trim()) {
      setError("Indique el resumen de cambios");
      return;
    }
    if (!form.stages.some((s) => s.title.trim() && s.body.trim())) {
      setError("Cada sección necesita título y cuerpo");
      return;
    }
    try {
      await onSave(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    }
  };

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-base">Editar procedimiento (formato Alfa)</CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          Use títulos como «1. Objetivo General», «2. Alcance», «6.1 …» para mantener el formato
          documental corporativo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Secciones del documento</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  stages: [
                    ...f.stages,
                    {
                      clientKey: newKey(),
                      title: `${f.stages.length + 1}. Nueva sección`,
                      body: "",
                      responsible: "",
                    },
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar sección
            </Button>
          </div>
          {form.stages.map((s, idx) => (
            <div key={s.clientKey} className="rounded-md border p-3 space-y-2 bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Sección {idx + 1}</span>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => moveStage(idx, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => moveStage(idx, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        stages: f.stages.filter((x) => x.clientKey !== s.clientKey),
                      }))
                    }
                    disabled={form.stages.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
              <Input
                placeholder="1. Objetivo General"
                value={s.title}
                onChange={(e) => updateStage(s.clientKey, { title: e.target.value })}
              />
              <Input
                placeholder="Responsable (opcional)"
                value={s.responsible}
                onChange={(e) => updateStage(s.clientKey, { responsible: e.target.value })}
              />
              <Textarea
                className="min-h-28"
                placeholder="Texto de la sección"
                value={s.body}
                onChange={(e) => updateStage(s.clientKey, { body: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Etiqueta versión</Label>
            <Input
              placeholder="Auto si vacío"
              value={form.versionLabel}
              onChange={(e) => setForm((f) => ({ ...f, versionLabel: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-xs">Aprobador *</Label>
            <select
              className="w-full h-10 rounded-md border px-3 text-sm"
              value={form.assignedApproverId}
              onChange={(e) => setForm((f) => ({ ...f, assignedApproverId: e.target.value }))}
            >
              <option value="">Seleccionar…</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.email})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Resumen de cambios *</Label>
          <Textarea
            className="mt-1 min-h-16"
            value={form.changeSummary}
            onChange={(e) => setForm((f) => ({ ...f, changeSummary: e.target.value }))}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enviando…" : "Enviar a aprobación"}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
