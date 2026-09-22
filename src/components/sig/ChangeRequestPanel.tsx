"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils/format";
import type { ProcedureStageView } from "./ProcedureViewer";

type ChangeRequest = {
  id: string;
  status: string;
  type: string;
  description: string;
  proposedTitle: string | null;
  proposedBody: string | null;
  targetStageId: string | null;
  targetStage: { id: string; title: string; sortOrder: number } | null;
  requester: { id: string; name: string; email: string };
  reviewer: { id: string; name: string; email: string } | null;
  reviewerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  GENERAL: "General",
  EDIT_STAGE: "Modificar etapa",
  ADD_STAGE: "Agregar etapa",
  REMOVE_STAGE: "Eliminar etapa",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Abierta",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  IMPLEMENTED: "Implementada",
  CANCELLED: "Cancelada",
};

type Props = {
  documentId: string;
  stages: ProcedureStageView[];
  canEdit: boolean;
  requestOpen: boolean;
  onRequestOpenChange: (open: boolean) => void;
  onAcceptRequest: (req: ChangeRequest) => void;
};

export function ChangeRequestPanel({
  documentId,
  stages,
  canEdit,
  requestOpen,
  onRequestOpenChange,
  onAcceptRequest,
}: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    type: "GENERAL",
    description: "",
    targetStageId: "",
    proposedTitle: "",
    proposedBody: "",
  });
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  const { data } = useQuery({
    queryKey: ["sig-change-requests", documentId],
    queryFn: async () => {
      const r = await fetch(`/api/sig/documents/${documentId}/change-requests`, {
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("Error al cargar solicitudes");
      return r.json() as Promise<{ data: ChangeRequest[] }>;
    },
  });

  const rows = data?.data ?? [];
  const openRows = rows.filter((r) => r.status === "OPEN" || r.status === "ACCEPTED");
  const closedRows = rows.filter(
    (r) => r.status !== "OPEN" && r.status !== "ACCEPTED"
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/sig/documents/${documentId}/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          type: form.type,
          description: form.description,
          targetStageId: form.targetStageId || null,
          proposedTitle: form.proposedTitle || null,
          proposedBody: form.proposedBody || null,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error");
    },
    onSuccess: () => {
      setMsg("Solicitud enviada");
      setForm({
        type: "GENERAL",
        description: "",
        targetStageId: "",
        proposedTitle: "",
        proposedBody: "",
      });
      onRequestOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["sig-change-requests", documentId] });
      queryClient.invalidateQueries({ queryKey: ["sig-document-bitacora", documentId] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const reviewMutation = useMutation({
    mutationFn: async (payload: {
      requestId: string;
      reviewAction: "ACCEPT" | "REJECT" | "CANCEL";
      reviewerNote?: string;
    }) => {
      const r = await fetch(`/api/sig/documents/${documentId}/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "review", ...payload }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error");
      return json.data as ChangeRequest;
    },
    onSuccess: (req, vars) => {
      queryClient.invalidateQueries({ queryKey: ["sig-change-requests", documentId] });
      queryClient.invalidateQueries({ queryKey: ["sig-document-bitacora", documentId] });
      if (vars.reviewAction === "ACCEPT") onAcceptRequest(req);
    },
    onError: (e: Error) => setMsg(e.message),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitudes de cambio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {msg && <p className="text-sm text-teal-800 bg-teal-50 p-2 rounded">{msg}</p>}
          {openRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay solicitudes abiertas.</p>
          ) : (
            <ul className="space-y-3">
              {openRows.map((r) => (
                <li key={r.id} className="rounded-md border p-3 text-sm space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{STATUS_LABELS[r.status] ?? r.status}</Badge>
                    <Badge variant="secondary">{TYPE_LABELS[r.type] ?? r.type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {r.requester.name} · {formatDate(r.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{r.description}</p>
                  {r.targetStage && (
                    <p className="text-xs text-muted-foreground">
                      Etapa: {r.targetStage.sortOrder}. {r.targetStage.title}
                    </p>
                  )}
                  {(r.proposedTitle || r.proposedBody) && (
                    <div className="rounded bg-muted/40 p-2 text-xs space-y-1">
                      {r.proposedTitle && <p><strong>Título propuesto:</strong> {r.proposedTitle}</p>}
                      {r.proposedBody && (
                        <p className="whitespace-pre-wrap">
                          <strong>Texto propuesto:</strong> {r.proposedBody}
                        </p>
                      )}
                    </div>
                  )}
                  {canEdit && r.status === "OPEN" && (
                    <div className="flex flex-wrap gap-2 items-end">
                      <Button
                        size="sm"
                        onClick={() =>
                          reviewMutation.mutate({ requestId: r.id, reviewAction: "ACCEPT" })
                        }
                        disabled={reviewMutation.isPending}
                      >
                        Aceptar e editar
                      </Button>
                      <div className="flex-1 min-w-[12rem]">
                        <Input
                          placeholder="Motivo rechazo"
                          value={rejectNote[r.id] ?? ""}
                          onChange={(e) =>
                            setRejectNote((m) => ({ ...m, [r.id]: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!rejectNote[r.id]?.trim() || reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            requestId: r.id,
                            reviewAction: "REJECT",
                            reviewerNote: rejectNote[r.id],
                          })
                        }
                      >
                        Rechazar
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {closedRows.length > 0 && (
            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Historial de solicitudes
              </p>
              <ul className="space-y-2">
                {closedRows.map((r) => (
                  <li key={r.id} className="rounded-md border bg-muted/20 p-3 text-sm space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{STATUS_LABELS[r.status] ?? r.status}</Badge>
                      <Badge variant="secondary">{TYPE_LABELS[r.type] ?? r.type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {r.requester.name} · {formatDate(r.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-muted-foreground">{r.description}</p>
                    {r.reviewer && (
                      <p className="text-xs text-muted-foreground">
                        Revisó: {r.reviewer.name}
                        {r.reviewedAt ? ` · ${formatDate(r.reviewedAt)}` : ""}
                      </p>
                    )}
                    {r.reviewerNote && (
                      <p className="text-xs whitespace-pre-wrap">Nota: {r.reviewerNote}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={requestOpen} onOpenChange={onRequestOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Solicitar cambio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <select
                className="w-full h-10 rounded-md border px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {(form.type === "EDIT_STAGE" || form.type === "REMOVE_STAGE") && (
              <div>
                <Label className="text-xs">Etapa</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={form.targetStageId}
                  onChange={(e) => setForm((f) => ({ ...f, targetStageId: e.target.value }))}
                >
                  <option value="">Seleccionar…</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sortOrder}. {s.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label className="text-xs">Descripción *</Label>
              <Textarea
                className="mt-1 min-h-24"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            {(form.type === "EDIT_STAGE" || form.type === "ADD_STAGE") && (
              <>
                <div>
                  <Label className="text-xs">Título propuesto</Label>
                  <Input
                    value={form.proposedTitle}
                    onChange={(e) => setForm((f) => ({ ...f, proposedTitle: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Texto propuesto</Label>
                  <Textarea
                    className="mt-1 min-h-20"
                    value={form.proposedBody}
                    onChange={(e) => setForm((f) => ({ ...f, proposedBody: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onRequestOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!form.description.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
