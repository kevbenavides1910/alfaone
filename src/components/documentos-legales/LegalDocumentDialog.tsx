"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { LEGAL_DOCUMENT_TYPES } from "@/modules/documentos-legales/business/catalog";
import type { LegalAttachmentDto, LegalDocumentDto, ResponsibleUserDto } from "@/modules/documentos-legales/business/dto";
import { formatReminderOffset } from "@/modules/documentos-legales/business/reminders";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { AttachmentPreviewDialog } from "@/components/expenses/AttachmentPreviewDialog";
import { apiJson } from "./api";

type ReminderDraft = { offsetValue: string; offsetUnit: "DAYS" | "MONTHS" };

type Draft = {
  type: string;
  otherTypeLabel: string;
  description: string;
  amount: string;
  dueDate: string;
  company: string;
  referenceNumber: string;
  notes: string;
  responsibleUserId: string;
  reminders: ReminderDraft[];
};

const PRESETS: ReminderDraft[] = [
  { offsetValue: "0", offsetUnit: "DAYS" },
  { offsetValue: "7", offsetUnit: "DAYS" },
  { offsetValue: "15", offsetUnit: "DAYS" },
  { offsetValue: "30", offsetUnit: "DAYS" },
  { offsetValue: "1", offsetUnit: "MONTHS" },
  { offsetValue: "2", offsetUnit: "MONTHS" },
  { offsetValue: "3", offsetUnit: "MONTHS" },
];

function draftFromDoc(doc: LegalDocumentDto | null, dueDate: string): Draft {
  if (!doc) {
    return {
      type: "GARANTIA",
      otherTypeLabel: "",
      description: "",
      amount: "",
      dueDate,
      company: "",
      referenceNumber: "",
      notes: "",
      responsibleUserId: "",
      reminders: [{ offsetValue: "7", offsetUnit: "DAYS" }],
    };
  }
  return {
    type: doc.type,
    otherTypeLabel: doc.otherTypeLabel ?? "",
    description: doc.description,
    amount: String(doc.amount),
    dueDate: doc.dueDate,
    company: doc.company ?? "",
    referenceNumber: doc.referenceNumber ?? "",
    notes: doc.notes ?? "",
    responsibleUserId: doc.responsibleUserId,
    reminders: doc.reminders.map((reminder) => ({
      offsetValue: String(reminder.offsetValue),
      offsetUnit: reminder.offsetUnit,
    })),
  };
}

export function LegalDocumentDialog({
  open,
  document,
  dueDate,
  companies,
  responsibles,
  canEdit,
  canAdmin = false,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  document: LegalDocumentDto | null;
  dueDate: string;
  companies: { code: string; name: string }[];
  responsibles: ResponsibleUserDto[];
  canEdit: boolean;
  canAdmin?: boolean;
  onClose: () => void;
  onSaved: (doc: LegalDocumentDto) => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFromDoc(document, dueDate));
  const [preview, setPreview] = useState<LegalAttachmentDto | null>(null);
  const documentId = document?.id;

  const attachments = useQuery({
    queryKey: ["documentos-legales-adjuntos", documentId],
    enabled: open && !!documentId,
    queryFn: () => apiJson<LegalAttachmentDto[]>(`/api/documentos-legales/${documentId}/attachments`),
  });

  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(draft.amount);
      const reminders = draft.reminders.map((reminder) => ({
        offsetValue: Number(reminder.offsetValue),
        offsetUnit: reminder.offsetUnit,
      }));
      if (!draft.description.trim()) throw new Error("La descripción es obligatoria");
      if (!Number.isFinite(amount) || amount < 0) throw new Error("El monto no puede ser negativo");
      if (!draft.responsibleUserId) throw new Error("El responsable es obligatorio");
      if (draft.type === "OTRO" && !draft.otherTypeLabel.trim()) {
        throw new Error("Indicá la etiqueta del tipo Otros");
      }
      if (reminders.length < 1 || reminders.some((reminder) => !Number.isInteger(reminder.offsetValue) || reminder.offsetValue < 0)) {
        throw new Error("Agregá al menos un recordatorio válido");
      }
      const body = {
        type: draft.type,
        otherTypeLabel: draft.type === "OTRO" ? draft.otherTypeLabel.trim() : null,
        description: draft.description.trim(),
        amount,
        dueDate: draft.dueDate,
        company: draft.company || null,
        referenceNumber: draft.referenceNumber.trim() || null,
        notes: draft.notes.trim() || null,
        responsibleUserId: draft.responsibleUserId,
        reminders,
      };
      if (documentId) {
        return apiJson<LegalDocumentDto>(`/api/documentos-legales/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      return apiJson<LegalDocumentDto>("/api/documentos-legales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: (saved) => {
      toast.success(documentId ? "Documento actualizado" : "Documento agendado");
      void queryClient.invalidateQueries({ queryKey: ["documentos-legales"] });
      onSaved(saved);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set("file", file);
      return apiJson<LegalAttachmentDto>(`/api/documentos-legales/${documentId}/attachments`, {
        method: "POST",
        body: form,
      });
    },
    onSuccess: () => {
      toast.success("Adjunto cargado");
      void attachments.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const markPaid = useMutation({
    mutationFn: (paid: boolean) =>
      apiJson<LegalDocumentDto>(`/api/documentos-legales/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid }),
      }),
    onSuccess: (saved) => {
      toast.success(saved.paid ? "Marcado como pagado" : "Marcado como pendiente");
      void queryClient.invalidateQueries({ queryKey: ["documentos-legales"] });
      onSaved(saved);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeDoc = useMutation({
    mutationFn: () => apiJson<void>(`/api/documentos-legales/${documentId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Documento eliminado");
      void queryClient.invalidateQueries({ queryKey: ["documentos-legales"] });
      onDeleted?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeAttachment = useMutation({
    mutationFn: (id: string) =>
      apiJson<void>(`/api/documentos-legales/${documentId}/attachments/${id}`, { method: "DELETE" }),
    onSuccess: () => void attachments.refetch(),
    onError: (error: Error) => toast.error(error.message),
  });

  function updateReminder(index: number, patch: Partial<ReminderDraft>) {
    setDraft((current) => ({
      ...current,
      reminders: current.reminders.map((reminder, i) => (i === index ? { ...reminder, ...patch } : reminder)),
    }));
  }

  function addReminder() {
    setDraft((current) => {
      const used = new Set(current.reminders.map((reminder) => `${reminder.offsetUnit}:${reminder.offsetValue}`));
      const next = PRESETS.find((preset) => !used.has(`${preset.offsetUnit}:${preset.offsetValue}`)) ?? {
        offsetValue: "60",
        offsetUnit: "DAYS" as const,
      };
      return { ...current, reminders: [...current.reminders, next] };
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{documentId ? "Editar obligación" : "Nueva obligación"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <Label>Tipo</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={draft.type}
                disabled={!canEdit}
                onChange={(event) => setDraft({ ...draft, type: event.target.value })}
              >
                {LEGAL_DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            {draft.type === "OTRO" && (
              <label className="space-y-1 text-sm">
                <Label>Etiqueta</Label>
                <Input
                  value={draft.otherTypeLabel}
                  disabled={!canEdit}
                  onChange={(event) => setDraft({ ...draft, otherTypeLabel: event.target.value })}
                />
              </label>
            )}
            <label className="space-y-1 text-sm sm:col-span-2">
              <Label>Descripción</Label>
              <Input
                value={draft.description}
                disabled={!canEdit}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <Label>Monto</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={draft.amount}
                disabled={!canEdit}
                onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <Label>Fecha de pago</Label>
              <Input
                type="date"
                value={draft.dueDate}
                disabled={!canEdit}
                onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <Label>Empresa</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={draft.company}
                disabled={!canEdit}
                onChange={(event) => setDraft({ ...draft, company: event.target.value })}
              >
                <option value="">Sin empresa</option>
                {companies.map((company) => (
                  <option key={company.code} value={company.code}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <Label>Referencia</Label>
              <Input
                value={draft.referenceNumber}
                disabled={!canEdit}
                onChange={(event) => setDraft({ ...draft, referenceNumber: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <Label>Responsable</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={draft.responsibleUserId}
                disabled={!canEdit}
                onChange={(event) => setDraft({ ...draft, responsibleUserId: event.target.value })}
              >
                <option value="">Seleccionar…</option>
                {responsibles.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <Label>Notas</Label>
              <textarea
                className="min-h-16 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={draft.notes}
                disabled={!canEdit}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Recordatorios</p>
              {canEdit && (
                <Button type="button" variant="outline" size="sm" onClick={addReminder}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Cada aviso es días o meses antes de la fecha. Cero es el mismo día. No se puede agendar sin al menos uno.
            </p>
            {draft.reminders.map((reminder, index) => {
              const value = Number(reminder.offsetValue);
              const label = Number.isInteger(value) && value >= 0
                ? formatReminderOffset({ offsetValue: value, offsetUnit: reminder.offsetUnit })
                : "Anticipación inválida";
              return (
                <div key={`${index}-${reminder.offsetUnit}`} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    className="w-24"
                    value={reminder.offsetValue}
                    disabled={!canEdit}
                    onChange={(event) => updateReminder(index, { offsetValue: event.target.value })}
                  />
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={reminder.offsetUnit}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateReminder(index, { offsetUnit: event.target.value as ReminderDraft["offsetUnit"] })
                    }
                  >
                    <option value="DAYS">días</option>
                    <option value="MONTHS">meses</option>
                  </select>
                  <span className="flex-1 text-xs text-muted-foreground">{label}</span>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={draft.reminders.length <= 1}
                      aria-label="Quitar recordatorio"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          reminders: current.reminders.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Adjuntos</p>
            {!documentId ? (
              <p className="text-xs text-muted-foreground">Guardá el documento para adjuntar archivos.</p>
            ) : (
              <>
                <ul className="space-y-1 text-sm">
                  {(attachments.data ?? []).map((file) => (
                    <li key={file.id} className="flex items-center justify-between gap-2">
                      <button type="button" className="truncate text-left hover:underline" onClick={() => setPreview(file)}>
                        {file.fileName}
                      </button>
                      {canEdit && (
                        <Button type="button" variant="outline" size="sm" onClick={() => removeAttachment.mutate(file.id)}>
                          Quitar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {canEdit && (
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xls,.xlsx,.csv"
                    disabled={upload.isPending}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) upload.mutate(file);
                    }}
                  />
                )}
              </>
            )}
          </div>

          <DialogFooter>
            {canEdit && documentId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => markPaid.mutate(!document?.paid)}
              >
                {document?.paid ? "Marcar pendiente" : "Marcar pagado"}
              </Button>
            )}
            {canAdmin && documentId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (window.confirm("¿Eliminar esta obligación?")) removeDoc.mutate();
                }}
              >
                Eliminar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            {canEdit && (
              <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Guardando…" : "Guardar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AttachmentPreviewDialog attachment={preview} onOpenChange={(next) => !next && setPreview(null)} />
    </>
  );
}
