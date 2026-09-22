"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProcedureContentData } from "./ProcedureViewer";
import {
  ALFA_FIXED_SECTIONS,
  activityCodeForIndex,
  displaySectionTitle,
  type AlfaSectionKey,
} from "@/modules/sig/business/procedure-sections";

export type ProcedureEditForm = {
  objective: string;
  scope: string;
  responsibilities: string;
  definitions: string;
  stages: {
    clientKey: string;
    sectionKey: AlfaSectionKey | null;
    title: string;
    body: string;
    responsible: string;
  }[];
  activities: {
    clientKey: string;
    code: string;
    name: string;
    description: string;
    documents: string;
    responsible: string;
  }[];
  changeSummary: string;
  assignedApproverId: string;
  versionLabel: string;
  changeRequestIds: string[];
  flowchartFile: File | null;
  clearFlowchart: boolean;
};

type ActivityRow = ProcedureEditForm["activities"][number];

function renumberActivities(rows: ActivityRow[]): ActivityRow[] {
  return rows.map((a, i) => ({
    ...a,
    code: activityCodeForIndex(i),
  }));
}

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

export function ProcedureEditor({
  initial,
  approvers,
  implementingRequestIds = [],
  seedFromRequest,
  onCancel,
  onSave,
  saving,
}: Props) {
  const proseSections = ALFA_FIXED_SECTIONS.filter((d) => d.kind === "prose").map((def) => {
    const found = (initial.sections ?? []).find((s) => s.sectionKey === def.key);
    const stage = (initial.stages ?? []).find((s) => s.sectionKey === def.key);
    return {
      clientKey: found && !found.id.startsWith("preview-") && !found.id.startsWith("fixed-")
        ? found.id
        : newKey(),
      sectionKey: def.key as AlfaSectionKey,
      title: displaySectionTitle(def.key),
      body: found?.body ?? stage?.body ?? "",
      responsible: found?.responsible ?? stage?.responsible ?? "",
    };
  });

  const [form, setForm] = useState<ProcedureEditForm>({
    objective: initial.body?.objective ?? "",
    scope: initial.body?.scope ?? "",
    responsibilities: initial.body?.responsibilities ?? "",
    definitions: initial.body?.definitions ?? "",
    stages: proseSections,
    activities: renumberActivities(
      (initial.activities ?? []).map((a) => ({
        clientKey: a.id.startsWith("preview-") ? newKey() : a.id,
        code: a.code,
        name: a.name,
        description: a.description,
        documents: a.documents ?? "",
        responsible: a.responsible ?? "",
      }))
    ),
    changeSummary: seedFromRequest?.description?.slice(0, 500) ?? "",
    assignedApproverId: "",
    versionLabel: "",
    changeRequestIds: implementingRequestIds,
    flowchartFile: null,
    clearFlowchart: false,
  });
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial.flowchartUrl ?? null);

  const updateStage = (key: string, patch: Partial<(typeof form.stages)[0]>) => {
    setForm((f) => ({
      ...f,
      stages: f.stages.map((s) => (s.clientKey === key ? { ...s, ...patch } : s)),
    }));
  };

  const updateActivity = (key: string, patch: Partial<(typeof form.activities)[0]>) => {
    setForm((f) => ({
      ...f,
      activities: f.activities.map((a) => (a.clientKey === key ? { ...a, ...patch } : a)),
    }));
  };

  const moveActivity = (index: number, dir: -1 | 1) => {
    setForm((f) => {
      const next = [...f.activities];
      const j = index + dir;
      if (j < 0 || j >= next.length) return f;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...f, activities: renumberActivities(next) };
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
    try {
      await onSave({ ...form, activities: renumberActivities(form.activities) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    }
  };

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-base">Editar procedimiento (formato Alfa)</CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          Los títulos de sección son fijos. Edite solo el contenido, la tabla de actividades y el
          diagrama de flujo.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="space-y-4">
          <Label>Secciones (títulos bloqueados)</Label>
          {form.stages.map((s) => (
            <div key={s.clientKey} className="rounded-md border p-3 space-y-2 bg-muted/20">
              <Input value={s.title} readOnly disabled className="font-semibold bg-muted/50" />
              <Textarea
                className="min-h-24"
                placeholder="Texto de la sección"
                value={s.body}
                onChange={(e) => updateStage(s.clientKey, { body: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>5. Diagrama de Flujo</Label>
              <p className="text-xs text-muted-foreground">Imagen PNG/JPEG/WebP</p>
            </div>
          </div>
          <div className="rounded border border-dashed p-4 space-y-3 bg-neutral-50">
            {previewUrl && !form.clearFlowchart ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Diagrama" className="max-h-56 mx-auto object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sin diagrama cargado</p>
            )}
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setForm((f) => ({ ...f, flowchartFile: file, clearFlowchart: false }));
                if (file) setPreviewUrl(URL.createObjectURL(file));
              }}
            />
            {(previewUrl || initial.flowchartUrl) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setForm((f) => ({ ...f, flowchartFile: null, clearFlowchart: true }));
                  setPreviewUrl(null);
                }}
              >
                Quitar diagrama
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>6. Descripción de Actividades</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  activities: renumberActivities([
                    ...f.activities,
                    {
                      clientKey: newKey(),
                      code: "",
                      name: "Nueva actividad",
                      description: "",
                      documents: "",
                      responsible: "",
                    },
                  ]),
                }))
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar fila
            </Button>
          </div>

          <div className="overflow-x-auto border border-neutral-400">
            <table className="w-full text-sm border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-neutral-200">
                  <th className="border border-neutral-400 px-2 py-2">Actividad</th>
                  <th className="border border-neutral-400 px-2 py-2">Descripción</th>
                  <th className="border border-neutral-400 px-2 py-2">Documentos</th>
                  <th className="border border-neutral-400 px-2 py-2">Responsable</th>
                  <th className="border border-neutral-400 px-2 py-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {form.activities.map((a, idx) => (
                  <tr key={a.clientKey} className="align-top">
                    <td className="border border-neutral-400 p-2 space-y-1 w-[18%]">
                      <p
                        className="h-8 flex items-center justify-center rounded-md border bg-muted/50 text-sm font-semibold tabular-nums"
                        title="Numeración automática según el orden de la fila"
                      >
                        {a.code}
                      </p>
                      <Input
                        className="h-8"
                        value={a.name}
                        onChange={(e) => updateActivity(a.clientKey, { name: e.target.value })}
                        placeholder="Nombre"
                      />
                    </td>
                    <td className="border border-neutral-400 p-2 w-[40%]">
                      <Textarea
                        className="min-h-24 text-sm"
                        value={a.description}
                        onChange={(e) =>
                          updateActivity(a.clientKey, { description: e.target.value })
                        }
                      />
                    </td>
                    <td className="border border-neutral-400 p-2 w-[20%]">
                      <Textarea
                        className="min-h-24 text-sm"
                        value={a.documents}
                        onChange={(e) => updateActivity(a.clientKey, { documents: e.target.value })}
                      />
                    </td>
                    <td className="border border-neutral-400 p-2 w-[16%]">
                      <Textarea
                        className="min-h-24 text-sm text-center"
                        value={a.responsible}
                        onChange={(e) =>
                          updateActivity(a.clientKey, { responsible: e.target.value })
                        }
                      />
                    </td>
                    <td className="border border-neutral-400 p-1">
                      <div className="flex flex-col gap-0.5">
                        <Button type="button" size="icon" variant="ghost" onClick={() => moveActivity(idx, -1)}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => moveActivity(idx, 1)}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              activities: renumberActivities(
                                f.activities.filter((x) => x.clientKey !== a.clientKey)
                              ),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {form.activities.length === 0 && (
                  <tr>
                    <td colSpan={5} className="border border-neutral-400 px-3 py-6 text-center text-muted-foreground">
                      Sin filas — agregue actividades
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
