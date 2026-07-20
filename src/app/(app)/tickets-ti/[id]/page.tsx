"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/client-session";
import { ArrowLeft, Loader2, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/utils/format";
import { hasPermission } from "@/lib/permissions/check";
import { ticketsTiBackPath } from "@/modules/tickets-ti/routes";
import {
  TicketAttachmentPicker,
  uploadTicketFiles,
} from "@/components/tickets-ti/TicketAttachmentPicker";
import { TICKETS_ATTACHMENT_CONFIG } from "@/modules/tickets-ti/config/tickets.config.client";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/tickets-ti/TicketBadges";
import { TICKET_STATUS_TRANSITIONS, type TicketStatusCode } from "@/modules/tickets-ti/business/status-transitions";

type TicketDetail = {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  solution: string | null;
  status: { code: string; name: string };
  priority: { code: string; name: string };
  category: { name: string };
  categoryDetail: string | null;
  type: { name: string };
  requester: { name: string; email: string };
  assignedTo: { id: string; name: string } | null;
  sla: { targetMinutes: number; remainingMinutes: number; status: string } | null;
  comments: {
    id: string;
    comment: string;
    isInternal: boolean;
    createdAt: string;
    user: { name: string };
    attachments: { id: string; originalName: string; fileSize: number; downloadUrl: string }[];
  }[];
  attachments: {
    id: string;
    originalName: string;
    fileSize: number;
    downloadUrl: string;
  }[];
  timeline: {
    id: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    reason: string | null;
    createdAt: string;
    changedBy: { name: string };
  }[];
  audits: { id: string; action: string; createdAt: string; user: { name: string } | null }[];
};

const ALL_TABS = ["info", "timeline", "comments", "attachments", "sla", "audit"] as const;
type TabId = (typeof ALL_TABS)[number];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const canManage = hasPermission(session, "ticketsTi.centro", "edit");
  const canDownload = hasPermission(session, "ticketsTi.attachments", "view");
  const canUpload = hasPermission(session, "ticketsTi.tickets", "edit");
  const backHref = ticketsTiBackPath(session);

  const visibleTabs = useMemo(() => {
    const tabs: TabId[] = ["info", "comments", "attachments"];
    if (canManage) tabs.splice(1, 0, "timeline", "sla", "audit");
    return tabs;
  }, [canManage]);

  const tabParam = searchParams.get("tab") as TabId | null;
  const tab = tabParam && visibleTabs.includes(tabParam) ? tabParam : "info";

  const [comment, setComment] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [internal, setInternal] = useState(false);
  const [solution, setSolution] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [statusCode, setStatusCode] = useState("");

  const { data, isLoading, error } = useQuery<{ data: TicketDetail }>({
    queryKey: ["tickets-ti", id],
    queryFn: async () => {
      const r = await fetch(`/api/tickets-ti/${id}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const { data: techData } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["tickets-ti-technicians"],
    enabled: canManage,
    queryFn: async () => {
      const r = await fetch("/api/tickets-ti/technicians");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const ticket = data?.data;
  const technicians = techData?.data ?? [];

  const nextStatuses = useMemo(() => {
    if (!ticket) return [];
    const code = ticket.status.code as TicketStatusCode;
    return TICKET_STATUS_TRANSITIONS[code] ?? [];
  }, [ticket]);

  const assignMut = useMutation({
    mutationFn: async (assignedToId: string | null) => {
      const r = await fetch(`/api/tickets-ti/${id}?action=assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets-ti", id] });
      qc.invalidateQueries({ queryKey: ["tickets-ti-dashboard"] });
      toast.success("Asignación actualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: async (payload: { statusCode: string; solution?: string }) => {
      const r = await fetch(`/api/tickets-ti/${id}?action=status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets-ti", id] });
      qc.invalidateQueries({ queryKey: ["tickets-ti-dashboard"] });
      toast.success("Estado actualizado");
      setStatusCode("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const commentMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/tickets-ti/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment, isInternal: internal }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      const row = json.data as { id: string };
      if (commentFiles.length > 0) {
        await uploadTicketFiles(id, commentFiles, row.id);
      }
      return row;
    },
    onSuccess: () => {
      setComment("");
      setCommentFiles([]);
      qc.invalidateQueries({ queryKey: ["tickets-ti", id] });
      toast.success("Comentario agregado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadMut = useMutation({
    mutationFn: async (files: File[]) => uploadTicketFiles(id, files),
    onSuccess: () => {
      setAttachmentFiles([]);
      qc.invalidateQueries({ queryKey: ["tickets-ti", id] });
      toast.success("Archivo(s) subido(s)");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-slate-500">Cargando ticket…</div>;
  if (error || !ticket) {
    return <div className="p-6 text-red-600">{(error as Error)?.message ?? "Ticket no encontrado"}</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2">
        <Link href={backHref}>
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-indigo-700">{ticket.ticketNumber}</p>
          <h1 className="text-xl font-bold text-slate-900">{ticket.title}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <TicketStatusBadge code={ticket.status.code} name={ticket.status.name} />
            <TicketPriorityBadge code={ticket.priority.code} name={ticket.priority.name} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        {visibleTabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => router.replace(`/tickets-ti/${id}?tab=${t}`)}
            className={`px-3 py-1.5 text-sm rounded-t-md ${
              tab === t ? "bg-white border border-b-white border-slate-200 font-medium" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t === "info" && "Información"}
            {t === "timeline" && "Historial"}
            {t === "comments" && "Comentarios"}
            {t === "attachments" && "Adjuntos"}
            {t === "sla" && "SLA"}
            {t === "audit" && "Auditoría"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {tab === "info" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Descripción</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap text-slate-700">{ticket.description}</CardContent>
            </Card>
          )}

          {tab === "timeline" && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                {ticket.timeline.map((ev, i) => (
                  <div key={ev.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                      {i < ticket.timeline.length - 1 && <div className="w-px flex-1 bg-slate-200 min-h-8" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-xs text-slate-500">{formatDate(ev.createdAt)} · {ev.changedBy.name}</p>
                      <p className="text-sm text-slate-800">
                        <span className="font-medium">{ev.field}</span>
                        {ev.oldValue && <> · {ev.oldValue} → </>}
                        {ev.newValue}
                      </p>
                      {ev.reason && <p className="text-xs text-slate-500">{ev.reason}</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {tab === "comments" && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                {ticket.comments.map((c) => (
                  <div key={c.id} className={`rounded-lg border p-3 ${c.isInternal ? "border-amber-200 bg-amber-50/50" : "border-slate-200"}`}>
                    <p className="text-xs text-slate-500 mb-1">
                      {c.user.name} · {formatDate(c.createdAt)}
                      {c.isInternal && " · Interno"}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{c.comment}</p>
                    {c.attachments?.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {c.attachments.map((a) => (
                          <li key={a.id}>
                            {canDownload ? (
                              <a href={a.downloadUrl} className="text-xs text-indigo-700 hover:underline inline-flex items-center gap-1">
                                <Paperclip className="h-3 w-3" /> {a.originalName}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                                <Paperclip className="h-3 w-3" /> {a.originalName}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                <div className="space-y-2 border-t pt-4">
                  <textarea
                    className="w-full min-h-[80px] rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Escriba un comentario…"
                  />
                  {canManage && (
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                      Nota interna
                    </label>
                  )}
                  {canUpload && (
                    <TicketAttachmentPicker
                      files={commentFiles}
                      onChange={setCommentFiles}
                      maxFiles={TICKETS_ATTACHMENT_CONFIG.maxFilesPerComment}
                      disabled={commentMut.isPending}
                      label="Adjuntos del comentario"
                    />
                  )}
                  <Button size="sm" className="gap-1" disabled={commentMut.isPending || !comment.trim()} onClick={() => commentMut.mutate()}>
                    {commentMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "attachments" && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                {ticket.attachments.length === 0 && <p className="text-sm text-slate-500">Sin adjuntos</p>}
                {ticket.attachments.map((a) =>
                  canDownload ? (
                    <a key={a.id} href={a.downloadUrl} className="flex items-center gap-2 text-sm text-indigo-700 hover:underline">
                      <Paperclip className="h-4 w-4" /> {a.originalName}
                    </a>
                  ) : (
                    <div key={a.id} className="flex items-center gap-2 text-sm text-slate-600">
                      <Paperclip className="h-4 w-4" /> {a.originalName}
                    </div>
                  )
                )}
                {canUpload && (
                  <>
                    <TicketAttachmentPicker
                      files={attachmentFiles}
                      onChange={setAttachmentFiles}
                      maxFiles={TICKETS_ATTACHMENT_CONFIG.maxFilesPerTicket}
                      disabled={uploadMut.isPending}
                    />
                    {attachmentFiles.length > 0 && (
                      <Button
                        size="sm"
                        disabled={uploadMut.isPending}
                        onClick={() => uploadMut.mutate(attachmentFiles)}
                      >
                        {uploadMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subir archivos"}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {tab === "sla" && (
            <Card>
              <CardContent className="pt-6 text-sm space-y-2">
                {ticket.sla ? (
                  <>
                    <p>Objetivo: {ticket.sla.targetMinutes} min</p>
                    <p>Restante: {ticket.sla.remainingMinutes} min</p>
                    <p>Estado SLA: {ticket.sla.status}</p>
                  </>
                ) : (
                  <p className="text-slate-500">Sin SLA registrado</p>
                )}
              </CardContent>
            </Card>
          )}

          {tab === "audit" && canManage && (
            <Card>
              <CardContent className="pt-6 space-y-2">
                {ticket.audits.map((a) => (
                  <div key={a.id} className="text-sm border-b border-slate-100 pb-2">
                    <span className="font-mono text-xs text-slate-500">{formatDate(a.createdAt)}</span>
                    <span className="ml-2">{a.action}</span>
                    {a.user && <span className="text-slate-500"> · {a.user.name}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-slate-700">
              <p>Solicitante: {ticket.requester.name}</p>
              <p>Categoría: {ticket.category.name}</p>
              {ticket.categoryDetail && (
                <p className="whitespace-pre-wrap">Detalle (Otro): {ticket.categoryDetail}</p>
              )}
              <p>Tipo: {ticket.type.name}</p>
              <p>Técnico: {ticket.assignedTo?.name ?? "—"}</p>
              {ticket.solution && <p className="whitespace-pre-wrap">Solución: {ticket.solution}</p>}
            </CardContent>
          </Card>

          {canManage && tab === "info" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Asignar técnico</Label>
                  <select
                    className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
                    value={assigneeId || ticket.assignedTo?.id || ""}
                    onChange={(e) => setAssigneeId(e.target.value)}
                  >
                    <option value="">Sin asignar</option>
                    {technicians.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <Button size="sm" className="w-full" disabled={assignMut.isPending} onClick={() => assignMut.mutate(assigneeId || null)}>
                    Guardar asignación
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label>Cambiar estado</Label>
                  <select className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm" value={statusCode} onChange={(e) => setStatusCode(e.target.value)}>
                    <option value="">Seleccione…</option>
                    {nextStatuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {statusCode === "RESUELTO" && (
                    <textarea
                      className="w-full min-h-[60px] rounded-md border border-slate-200 px-2 py-1 text-sm"
                      placeholder="Solución"
                      value={solution}
                      onChange={(e) => setSolution(e.target.value)}
                    />
                  )}
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!statusCode || statusMut.isPending}
                    onClick={() => statusMut.mutate({ statusCode, solution: solution || undefined })}
                  >
                    Aplicar estado
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
