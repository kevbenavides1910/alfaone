"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Download,
  FileText,
  Paperclip,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { useSession } from "@/lib/auth/client-session";
import { cn } from "@/lib/utils/cn";
import {
  CALENDARIO_EVIDENCE_EXTENSIONS,
  CALENDARIO_EVIDENCE_MAX_BYTES,
  CALENDARIO_EVIDENCE_MAX_FILES,
  CALENDARIO_STATUS_BADGE,
  CALENDARIO_STATUS_LABELS,
  calendarioColorClass,
  type CalendarioAttachment,
  type CalendarioEventDetail,
  type CalendarioZoneRef,
} from "@/modules/naf-operaciones/business/calendario-types";
import {
  CALENDARIO_API,
  calendarioFetch,
  calendarioUpload,
  formatFileSize,
  selectClass,
} from "./calendario-api";

type Props = {
  eventId: string;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (eventId: string) => void;
};

const NO_ZONE = "__none__";
const ACCEPT = CALENDARIO_EVIDENCE_EXTENSIONS.map((e) => `.${e}`).join(",");

export function CalendarioEventoDetalleDialog({ eventId, canEdit, onClose, onEdit }: Props) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [zoneFilter, setZoneFilter] = useState("");
  const [evidenceContractId, setEvidenceContractId] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const detailKey = ["calendario-operativo", "evento", eventId];

  const query = useQuery({
    queryKey: detailKey,
    queryFn: () => calendarioFetch<CalendarioEventDetail>(`${CALENDARIO_API}/${eventId}`),
  });
  const ev = query.data;
  const userId = session?.user?.id;
  const isAssigned = Boolean(userId && ev?.admins.some((a) => a.id === userId));
  const canAct = canEdit || isAssigned;

  const zones = useMemo(() => {
    const map = new Map<string, CalendarioZoneRef>();
    for (const c of ev?.contracts ?? []) for (const z of c.zones) map.set(z.id, z);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [ev]);

  const visible = useMemo(() => {
    const list = ev?.contracts ?? [];
    if (!zoneFilter) return list;
    if (zoneFilter === NO_ZONE) return list.filter((c) => c.zones.length === 0);
    return list.filter((c) => c.zones.some((z) => z.id === zoneFilter));
  }, [ev, zoneFilter]);

  const evidenceByContract = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of ev?.attachments ?? []) {
      if (a.contract) map.set(a.contract.id, (map.get(a.contract.id) ?? 0) + 1);
    }
    return map;
  }, [ev]);

  const onUpdated = (data: CalendarioEventDetail) => {
    qc.setQueryData(detailKey, data);
    qc.invalidateQueries({ queryKey: ["calendario-operativo", "eventos"] });
  };
  const onError = (fallback: string) => (e: unknown) =>
    toast.error(e instanceof Error ? e.message : fallback);

  const completion = useMutation({
    mutationFn: (body: { contractIds?: string[]; completed: boolean }) =>
      calendarioFetch<CalendarioEventDetail>(`${CALENDARIO_API}/${eventId}/contratos`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: onUpdated,
    onError: onError("Error al actualizar"),
  });

  const setStatus = useMutation({
    mutationFn: (status: "DONE" | "SCHEDULED") =>
      calendarioFetch<CalendarioEventDetail>(`${CALENDARIO_API}/${eventId}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (data) => {
      onUpdated(data);
      toast.success(data.status === "DONE" ? "Actividad marcada como realizada" : "Actividad marcada como pendiente");
    },
    onError: onError("Error al cambiar el estado"),
  });

  const cancelEvent = useMutation({
    mutationFn: () =>
      calendarioFetch<CalendarioEventDetail>(`${CALENDARIO_API}/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: ev?.status === "CANCELLED" ? "SCHEDULED" : "CANCELLED" }),
      }),
    onSuccess: (data) => {
      onUpdated(data);
      toast.success(data.status === "CANCELLED" ? "Evento cancelado" : "Evento reactivado");
    },
    onError: onError("Error al actualizar"),
  });

  const remove = useMutation({
    mutationFn: () => calendarioFetch<void>(`${CALENDARIO_API}/${eventId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Evento eliminado");
      qc.invalidateQueries({ queryKey: ["calendario-operativo", "eventos"] });
      onClose();
    },
    onError: onError("Error al eliminar"),
  });

  const upload = useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      if (evidenceContractId) form.append("contractId", evidenceContractId);
      return calendarioUpload<CalendarioEventDetail>(`${CALENDARIO_API}/${eventId}/evidencias`, form);
    },
    onSuccess: (data, files) => {
      onUpdated(data);
      toast.success(files.length === 1 ? "Evidencia adjuntada" : `${files.length} evidencias adjuntadas`);
    },
    onError: onError("Error al subir la evidencia"),
    onSettled: () => {
      if (fileInput.current) fileInput.current.value = "";
    },
  });

  const removeEvidence = useMutation({
    mutationFn: (attachmentId: string) =>
      calendarioFetch<CalendarioEventDetail>(`${CALENDARIO_API}/${eventId}/evidencias/${attachmentId}`, {
        method: "DELETE",
      }),
    onSuccess: (data) => {
      onUpdated(data);
      toast.success("Evidencia eliminada");
    },
    onError: onError("Error al eliminar la evidencia"),
  });

  const onPickFiles = (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (files.length === 0) return;
    if (files.length > CALENDARIO_EVIDENCE_MAX_FILES) {
      toast.error(`Máximo ${CALENDARIO_EVIDENCE_MAX_FILES} archivos por carga`);
      return;
    }
    const tooBig = files.find((f) => f.size > CALENDARIO_EVIDENCE_MAX_BYTES);
    if (tooBig) {
      toast.error(`«${tooBig.name}» supera ${CALENDARIO_EVIDENCE_MAX_BYTES / 1024 / 1024} MB`);
      return;
    }
    upload.mutate(files);
  };

  const visiblePending = visible.filter((c) => !c.completedAt).map((c) => c.id);
  const visibleDone = visible.filter((c) => c.completedAt).map((c) => c.id);
  const pct = ev && ev.contractsCount ? Math.round((ev.completedCount / ev.contractsCount) * 100) : 0;
  const busy =
    completion.isPending ||
    setStatus.isPending ||
    cancelEvent.isPending ||
    remove.isPending ||
    upload.isPending ||
    removeEvidence.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        {!ev ? (
          <>
            <DialogHeader>
              <DialogTitle>Evento</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-500">
              {query.isError ? (query.error as Error).message : "Cargando…"}
            </p>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className={cn(ev.status === "CANCELLED" && "line-through")}>{ev.title}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{ev.date}</span>
                <span className={cn("rounded border px-2 py-0.5 text-xs", calendarioColorClass(ev.type.color))}>
                  {ev.type.name}
                </span>
                <span className={cn("rounded border px-2 py-0.5 text-xs font-medium", CALENDARIO_STATUS_BADGE[ev.status])}>
                  {CALENDARIO_STATUS_LABELS[ev.status]}
                </span>
                <span>· {ev.zone?.name ?? "Varias zonas"}</span>
                {ev.appliesToAllContracts ? <span>· todos los contratos</span> : null}
                {ev.createdByName ? <span>· creado por {ev.createdByName}</span> : null}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                <div>
                  <div className="text-xs uppercase text-gray-500">Administradores</div>
                  <div className="font-medium">
                    {ev.admins.length ? ev.admins.map((a) => a.name).join(", ") : "Sin asignar"}
                  </div>
                  {ev.status === "DONE" && ev.completedAt ? (
                    <div className="mt-1 text-xs text-emerald-700">
                      Realizada el {new Date(ev.completedAt).toLocaleString("es-CR")}
                      {ev.completedByName ? ` por ${ev.completedByName}` : ""}
                    </div>
                  ) : null}
                </div>
              </div>
              {canAct && ev.status !== "CANCELLED" ? (
                ev.status === "DONE" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setStatus.mutate("SCHEDULED")}
                  >
                    <RotateCcw className="mr-1 h-4 w-4" /> Volver a pendiente
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={busy}
                    onClick={() => {
                      const pending = ev.contractsCount - ev.completedCount;
                      if (
                        pending === 0 ||
                        window.confirm(`Se marcarán también como realizados los ${pending} contratos pendientes. ¿Continuar?`)
                      ) {
                        setStatus.mutate("DONE");
                      }
                    }}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Marcar como realizada
                  </Button>
                )
              ) : null}
            </div>

            {ev.description ? (
              <p className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">{ev.description}</p>
            ) : null}

            <div>
              <div className="mb-1 flex justify-between text-xs text-gray-600">
                <span>Avance por contrato</span>
                <span>
                  {ev.completedCount}/{ev.contractsCount} ({pct}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-gray-100">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select className={selectClass} value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
                <option value="">Todas las zonas ({ev.contracts.length})</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
                <option value={NO_ZONE}>Sin zona asignada</option>
              </select>
              {canAct ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || visiblePending.length === 0}
                    onClick={() => completion.mutate({ contractIds: visiblePending, completed: true })}
                  >
                    Marcar {zoneFilter ? "zona" : "todos"} como realizado ({visiblePending.length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy || visibleDone.length === 0}
                    onClick={() => completion.mutate({ contractIds: visibleDone, completed: false })}
                  >
                    Desmarcar ({visibleDone.length})
                  </Button>
                </>
              ) : null}
            </div>

            <div className="max-h-80 overflow-y-auto rounded border">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="w-10 px-3 py-2">✓</th>
                    <th className="px-3 py-2">Contrato</th>
                    <th className="px-3 py-2">Zona(s)</th>
                    <th className="px-3 py-2">Realizado</th>
                    <th className="w-10 px-3 py-2" title="Evidencias">
                      <Paperclip className="h-3.5 w-3.5" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          disabled={!canAct || busy}
                          checked={Boolean(c.completedAt)}
                          onChange={(e) => completion.mutate({ contractIds: [c.id], completed: e.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="font-medium">{c.client}</div>
                        <div className="font-mono text-xs text-gray-500">
                          {c.licitacionNo} · {c.company}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">
                        {c.zones.map((z) => z.name).join(", ") || "—"}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">
                        {c.completedAt ? new Date(c.completedAt).toLocaleDateString("es-CR") : "Pendiente"}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">{evidenceByContract.get(c.id) || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <section className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Paperclip className="h-4 w-4" /> Evidencias ({ev.attachments.length})
                </h4>
                {canAct ? (
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <select
                      className={selectClass}
                      value={evidenceContractId}
                      onChange={(e) => setEvidenceContractId(e.target.value)}
                      title="Contrato al que corresponde la evidencia"
                    >
                      <option value="">General del evento</option>
                      {ev.contracts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.client} · {c.licitacionNo}
                        </option>
                      ))}
                    </select>
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      accept={ACCEPT}
                      className="hidden"
                      onChange={(e) => onPickFiles(e.target.files)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => fileInput.current?.click()}
                    >
                      <Upload className="mr-1 h-4 w-4" />
                      {upload.isPending ? "Subiendo…" : "Adjuntar evidencia"}
                    </Button>
                  </div>
                ) : null}
              </div>
              {canAct ? (
                <p className="text-xs text-gray-500">
                  Fotos, PDF, Word, Excel o video (hasta {CALENDARIO_EVIDENCE_MAX_FILES} archivos de{" "}
                  {CALENDARIO_EVIDENCE_MAX_BYTES / 1024 / 1024} MB por carga).
                </p>
              ) : null}
              {ev.attachments.length === 0 ? (
                <p className="py-3 text-center text-sm text-gray-500">Sin evidencias adjuntas.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {ev.attachments.map((a) => (
                    <EvidenceItem
                      key={a.id}
                      a={a}
                      canDelete={canAct && !busy}
                      onDelete={() => {
                        if (window.confirm(`¿Eliminar la evidencia «${a.originalName}»?`)) removeEvidence.mutate(a.id);
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>

            {canEdit ? (
              <DialogFooter className="gap-2 sm:justify-between">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("¿Eliminar este evento, su avance por contrato y sus evidencias?")) remove.mutate();
                    }}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Eliminar
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => cancelEvent.mutate()}>
                    <XCircle className="mr-1 h-4 w-4" />
                    {ev.status === "CANCELLED" ? "Reactivar" : "Cancelar evento"}
                  </Button>
                </div>
                <Button type="button" onClick={() => onEdit(ev.id)}>
                  <Pencil className="mr-1 h-4 w-4" /> Editar
                </Button>
              </DialogFooter>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EvidenceItem({
  a,
  canDelete,
  onDelete,
}: {
  a: CalendarioAttachment;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const isImage = a.mimeType.startsWith("image/") && a.mimeType !== "image/heic";
  return (
    <li className="flex items-center gap-2 rounded border p-2 text-sm">
      <a href={a.url} target="_blank" rel="noreferrer" className="shrink-0">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.url} alt={a.originalName} className="h-12 w-12 rounded object-cover" loading="lazy" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-gray-500">
            <FileText className="h-5 w-5" />
          </span>
        )}
      </a>
      <div className="min-w-0 flex-1">
        <a href={a.url} target="_blank" rel="noreferrer" className="block truncate font-medium hover:underline">
          {a.originalName}
        </a>
        <div className="truncate text-xs text-gray-500">{a.contract?.label ?? "General del evento"}</div>
        <div className="truncate text-xs text-gray-400">
          {formatFileSize(a.fileSize)} · {new Date(a.createdAt).toLocaleDateString("es-CR")}
          {a.uploadedByName ? ` · ${a.uploadedByName}` : ""}
        </div>
      </div>
      <a
        href={`${a.url}?download=1`}
        className="rounded p-1 text-gray-500 hover:bg-gray-100"
        title="Descargar"
      >
        <Download className="h-4 w-4" />
      </a>
      {canDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1 text-red-600 hover:bg-red-50"
          title="Eliminar evidencia"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </li>
  );
}
