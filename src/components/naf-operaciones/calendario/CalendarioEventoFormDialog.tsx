"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import Link from "next/link";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import {
  CALENDARIO_EVENT_STATUSES,
  CALENDARIO_STATUS_LABELS,
  type CalendarioContractOption,
  type CalendarioEventDetail,
  type CalendarioEventStatus,
  type CalendarioEventTypeOption,
  type CalendarioZoneRef,
} from "@/modules/naf-operaciones/business/calendario-types";
import {
  CALENDARIO_API,
  CALENDARIO_TIPOS_ADMIN_HREF,
  calendarioFetch,
  selectClass,
  type CalendarioOpciones,
} from "./calendario-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
  eventId?: string;
  zones: CalendarioZoneRef[];
  types: CalendarioEventTypeOption[];
  defaultZoneId?: string;
  onSaved: (eventId: string) => void;
};

export function CalendarioEventoFormDialog({
  open,
  onOpenChange,
  initialDate,
  eventId,
  zones,
  types,
  defaultZoneId,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const canManageTypes = hasPermission(session, "plataforma.catalogs", "edit");
  const isEdit = Boolean(eventId);

  const [date, setDate] = useState(initialDate ?? "");
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState("");
  const [originalTypeId, setOriginalTypeId] = useState("");
  const [status, setStatus] = useState<CalendarioEventStatus>("SCHEDULED");
  const [description, setDescription] = useState("");
  const [zoneId, setZoneId] = useState(defaultZoneId ?? "");
  const [search, setSearch] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Contratos vistos en cualquier zona, para conservar la selección al cambiar de zona. */
  const known = useRef(new Map<string, CalendarioContractOption>());

  const existing = useQuery({
    queryKey: ["calendario-operativo", "evento", eventId],
    queryFn: () => calendarioFetch<CalendarioEventDetail>(`${CALENDARIO_API}/${eventId}`),
    enabled: isEdit,
  });

  useEffect(() => {
    const ev = existing.data;
    if (!ev) return;
    setDate(ev.date);
    setTitle(ev.title);
    setTypeId(ev.type.id);
    setOriginalTypeId(ev.type.id);
    setStatus(ev.status);
    setDescription(ev.description ?? "");
    setZoneId(ev.zone?.id ?? "");
    for (const c of ev.contracts) known.current.set(c.id, c);
    setSelected(new Set(ev.contracts.map((c) => c.id)));
  }, [existing.data]);

  const typeOptions = useMemo(
    () => types.filter((t) => t.isActive || t.id === originalTypeId),
    [types, originalTypeId],
  );

  useEffect(() => {
    if (!isEdit && !typeId && typeOptions.length > 0) setTypeId(typeOptions[0].id);
  }, [isEdit, typeId, typeOptions]);

  const contractsQuery = useQuery({
    queryKey: ["calendario-operativo", "opciones", zoneId],
    queryFn: () =>
      calendarioFetch<CalendarioOpciones>(
        `${CALENDARIO_API}/opciones${zoneId ? `?zoneId=${encodeURIComponent(zoneId)}` : ""}`,
      ),
    staleTime: 5 * 60_000,
  });
  const zoneContracts = useMemo(() => contractsQuery.data?.contracts ?? [], [contractsQuery.data]);

  useEffect(() => {
    for (const c of zoneContracts) known.current.set(c.id, c);
  }, [zoneContracts]);

  const visible = useMemo(() => {
    const base = onlySelected
      ? [...selected].map((id) => known.current.get(id)).filter((c): c is CalendarioContractOption => !!c)
      : zoneContracts;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.client.toLowerCase().includes(q) ||
        c.licitacionNo.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q),
    );
  }, [zoneContracts, onlySelected, selected, search]);

  const allZoneSelected =
    zoneContracts.length > 0 && zoneContracts.every((c) => selected.has(c.id));
  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.has(c.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const save = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      const allContracts = allZoneSelected && ids.length === zoneContracts.length;
      const everyInZone =
        zoneId !== "" &&
        ids.every((id) => known.current.get(id)?.zones.some((z) => z.id === zoneId));
      const payload = {
        date,
        title: title.trim(),
        typeId,
        status,
        description: description.trim() || null,
        zoneId: everyInZone || allContracts ? zoneId || null : null,
        allContracts,
        contractIds: ids,
      };
      return isEdit
        ? calendarioFetch<CalendarioEventDetail>(`${CALENDARIO_API}/${eventId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : calendarioFetch<CalendarioEventDetail>(CALENDARIO_API, {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: (ev) => {
      toast.success(isEdit ? "Evento actualizado" : `Evento creado para ${ev.contractsCount} contratos`);
      qc.invalidateQueries({ queryKey: ["calendario-operativo", "eventos"] });
      qc.invalidateQueries({ queryKey: ["calendario-operativo", "evento", ev.id] });
      onSaved(ev.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al guardar"),
  });

  const canSave = date && title.trim() && typeId && selected.size > 0 && !save.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar evento" : "Nuevo evento operativo"}</DialogTitle>
          <DialogDescription>
            Elija la zona para filtrar los contratos y marque uno, varios o todos. La selección se
            conserva al cambiar de zona.
          </DialogDescription>
        </DialogHeader>

        {isEdit && existing.isLoading ? <p className="text-sm text-gray-500">Cargando evento…</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="cal-title">Título</Label>
            <Input
              id="cal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Cambio de uniformes temporada lluviosa"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cal-date">Fecha</Label>
            <Input id="cal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="cal-type">Tipo</Label>
              {canManageTypes ? (
                <Link href={CALENDARIO_TIPOS_ADMIN_HREF} className="text-xs text-blue-600 hover:underline">
                  Administrar tipos
                </Link>
              ) : null}
            </div>
            <select
              id="cal-type"
              className={`${selectClass} w-full`}
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              {typeOptions.length === 0 ? <option value="">Sin tipos activos</option> : null}
              {typeOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isActive ? "" : " (inactivo)"}
                </option>
              ))}
            </select>
          </div>
          {isEdit ? (
            <div className="space-y-1">
              <Label htmlFor="cal-status">Estado</Label>
              <select
                id="cal-status"
                className={`${selectClass} w-full`}
                value={status}
                onChange={(e) => setStatus(e.target.value as CalendarioEventStatus)}
              >
                {CALENDARIO_EVENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CALENDARIO_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="cal-desc">Descripción / instrucciones</Label>
            <Textarea
              id="cal-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="cal-zone">Zona</Label>
              <select
                id="cal-zone"
                className={selectClass}
                value={zoneId}
                onChange={(e) => {
                  setZoneId(e.target.value);
                  setOnlySelected(false);
                }}
              >
                <option value="">Todas las zonas</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              className="h-9 min-w-[200px] flex-1"
              placeholder="Buscar cliente, licitación o empresa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={visible.length === 0}
              onClick={() => setMany(visible.map((c) => c.id), !allVisibleSelected)}
            >
              {allVisibleSelected ? "Desmarcar visibles" : `Marcar todos (${visible.length})`}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={selected.size === 0}
              onClick={() => setSelected(new Set())}
            >
              Limpiar selección
            </Button>
            <label className="flex items-center gap-1.5 text-gray-600">
              <input
                type="checkbox"
                checked={onlySelected}
                onChange={(e) => setOnlySelected(e.target.checked)}
              />
              Solo seleccionados
            </label>
            <span className="ml-auto font-medium">
              {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
              {allZoneSelected ? (zoneId ? " · toda la zona" : " · todos los contratos") : ""}
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto rounded border">
            {contractsQuery.isLoading ? (
              <p className="p-4 text-center text-sm text-gray-500">Cargando contratos…</p>
            ) : visible.length === 0 ? (
              <p className="p-4 text-center text-sm text-gray-500">No hay contratos vigentes con este filtro.</p>
            ) : (
              <ul className="divide-y text-sm">
                {visible.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-start gap-2 px-3 py-1.5 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{c.client}</span>
                        <span className="ml-2 font-mono text-xs text-gray-500">
                          {c.licitacionNo} · {c.company}
                        </span>
                        {c.zones.length ? (
                          <span className="block text-xs text-gray-500">
                            {c.zones.map((z) => z.name).join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => save.mutate()}>
            {save.isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
