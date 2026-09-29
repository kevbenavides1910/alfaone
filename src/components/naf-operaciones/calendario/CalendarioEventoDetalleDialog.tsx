"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, XCircle } from "lucide-react";
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
import { cn } from "@/lib/utils/cn";
import {
  CALENDARIO_STATUS_LABELS,
  CALENDARIO_TYPE_COLORS,
  CALENDARIO_TYPE_LABELS,
  type CalendarioEventDetail,
  type CalendarioZoneRef,
} from "@/modules/naf-operaciones/business/calendario-types";
import { CALENDARIO_API, calendarioFetch, selectClass } from "./calendario-api";

type Props = {
  eventId: string;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (eventId: string) => void;
};

const NO_ZONE = "__none__";

export function CalendarioEventoDetalleDialog({ eventId, canEdit, onClose, onEdit }: Props) {
  const qc = useQueryClient();
  const [zoneFilter, setZoneFilter] = useState("");
  const detailKey = ["calendario-operativo", "evento", eventId];

  const query = useQuery({
    queryKey: detailKey,
    queryFn: () => calendarioFetch<CalendarioEventDetail>(`${CALENDARIO_API}/${eventId}`),
  });
  const ev = query.data;

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

  const onUpdated = (data: CalendarioEventDetail) => {
    qc.setQueryData(detailKey, data);
    qc.invalidateQueries({ queryKey: ["calendario-operativo", "eventos"] });
  };

  const completion = useMutation({
    mutationFn: (body: { contractIds?: string[]; completed: boolean }) =>
      calendarioFetch<CalendarioEventDetail>(`${CALENDARIO_API}/${eventId}/contratos`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: onUpdated,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al actualizar"),
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
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al actualizar"),
  });

  const remove = useMutation({
    mutationFn: () => calendarioFetch<void>(`${CALENDARIO_API}/${eventId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Evento eliminado");
      qc.invalidateQueries({ queryKey: ["calendario-operativo", "eventos"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al eliminar"),
  });

  const visiblePending = visible.filter((c) => !c.completedAt).map((c) => c.id);
  const visibleDone = visible.filter((c) => c.completedAt).map((c) => c.id);
  const pct = ev && ev.contractsCount ? Math.round((ev.completedCount / ev.contractsCount) * 100) : 0;
  const busy = completion.isPending || cancelEvent.isPending || remove.isPending;

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
                <span className={cn("rounded border px-2 py-0.5 text-xs", CALENDARIO_TYPE_COLORS[ev.type])}>
                  {CALENDARIO_TYPE_LABELS[ev.type]}
                </span>
                <span>{CALENDARIO_STATUS_LABELS[ev.status]}</span>
                <span>· {ev.zone?.name ?? "Varias zonas"}</span>
                {ev.appliesToAllContracts ? <span>· todos los contratos</span> : null}
                {ev.createdByName ? <span>· creado por {ev.createdByName}</span> : null}
              </DialogDescription>
            </DialogHeader>

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
              {canEdit ? (
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
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          disabled={!canEdit || busy}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canEdit ? (
              <DialogFooter className="gap-2 sm:justify-between">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("¿Eliminar este evento y su avance por contrato?")) remove.mutate();
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
