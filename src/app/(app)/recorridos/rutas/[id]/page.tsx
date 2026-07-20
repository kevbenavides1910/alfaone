"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, Clock, HeartPulse, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/components/ui/toaster";

type Point = {
  id: string;
  code: string;
  name: string;
  nfcTagCode: string | null;
  latitude: string | null;
  longitude: string | null;
  radiusM: number;
  sortOrder: number;
};

type ScheduleSlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  sortOrder: number;
};

type Contract = { id: string; licitacionNo: string; client: string };
type Location = { id: string; name: string };
type Position = { id: string; name: string };

type RouteDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  contractId: string | null;
  locationId: string | null;
  positionId: string | null;
  contract: Contract | null;
  location: Location | null;
  position: Position | null;
  openSchedule: boolean;
  samePointsEveryDay: boolean;
  schedules: ScheduleSlot[];
  points: Point[];
  pointDays: Array<{ pointId: string; dayOfWeek: number }>;
  welfareEnabled: boolean;
  welfareIntervalMinutes: number;
};

type RouteForm = {
  name: string;
  isActive: boolean;
  contractId: string;
  locationId: string;
  positionId: string;
};

const emptyPoint = {
  code: "",
  name: "",
  latitude: "",
  longitude: "",
  radiusM: 100,
  sortOrder: 0,
};

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function RecorridosRutaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [pointOpen, setPointOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);
  const [pointForm, setPointForm] = useState(emptyPoint);
  const [routeForm, setRouteForm] = useState<RouteForm | null>(null);
  const [scheduleForm, setScheduleForm] = useState<{
    openSchedule: boolean;
    slots: ScheduleSlot[];
  } | null>(null);
  const [welfareForm, setWelfareForm] = useState<{
    enabled: boolean;
    intervalMinutes: number;
  } | null>(null);
  const [pointDaysForm, setPointDaysForm] = useState<{
    samePointsEveryDay: boolean;
    /** key `${pointId}:${dayOfWeek}` */
    active: Set<string>;
  } | null>(null);

  const { data, isLoading } = useQuery<{ data: RouteDetail }>({
    queryKey: ["patrol-route", id],
    queryFn: () => fetch(`/api/admin/patrol/routes/${id}`).then((r) => r.json()),
  });

  const { data: contractsData } = useQuery<{ data: Contract[] }>({
    queryKey: ["patrol-contracts"],
    queryFn: () => fetch("/api/admin/patrol/contracts").then((r) => r.json()),
  });

  const route = data?.data;
  const meta: RouteForm | null =
    routeForm ??
    (route
      ? {
          name: route.name,
          isActive: route.isActive,
          contractId: route.contractId ?? "",
          locationId: route.locationId ?? "",
          positionId: route.positionId ?? "",
        }
      : null);

  const scheduleMeta =
    scheduleForm ??
    (route
      ? {
          openSchedule: route.openSchedule ?? false,
          slots: (route.schedules ?? []).map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            sortOrder: s.sortOrder,
          })),
        }
      : null);

  const welfareMeta =
    welfareForm ??
    (route
      ? {
          enabled: route.welfareEnabled ?? false,
          intervalMinutes: route.welfareIntervalMinutes ?? 60,
        }
      : null);

  function buildAllPointsActiveSet(points: Point[]): Set<string> {
    const active = new Set<string>();
    for (const p of points) {
      for (let day = 0; day <= 6; day++) {
        active.add(`${p.id}:${day}`);
      }
    }
    return active;
  }

  const pointDaysMeta =
    pointDaysForm ??
    (route
      ? (() => {
          const same = route.samePointsEveryDay ?? true;
          const active = new Set(
            (route.pointDays ?? []).map((d) => `${d.pointId}:${d.dayOfWeek}`),
          );
          if (!same) {
            for (const p of route.points) {
              const hasAny = [0, 1, 2, 3, 4, 5, 6].some((d) => active.has(`${p.id}:${d}`));
              if (!hasAny) {
                for (let d = 0; d <= 6; d++) active.add(`${p.id}:${d}`);
              }
            }
          }
          return {
            samePointsEveryDay: same,
            active: same || active.size === 0 ? buildAllPointsActiveSet(route.points) : active,
          };
        })()
      : null);

  function setSamePointsEveryDay(checked: boolean) {
    if (!route || !pointDaysMeta) return;
    if (checked) {
      setPointDaysForm({ samePointsEveryDay: true, active: pointDaysMeta.active });
      return;
    }
    // Al desactivar: partir de todos seleccionados para que el usuario desmarque
    setPointDaysForm({
      samePointsEveryDay: false,
      active: buildAllPointsActiveSet(route.points),
    });
  }

  function togglePointDay(pointId: string, dayOfWeek: number) {
    if (!pointDaysMeta || pointDaysMeta.samePointsEveryDay) return;
    const key = `${pointId}:${dayOfWeek}`;
    const next = new Set(pointDaysMeta.active);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPointDaysForm({ ...pointDaysMeta, active: next });
  }

  function setAllPointsForDay(dayOfWeek: number, selected: boolean) {
    if (!route || !pointDaysMeta || pointDaysMeta.samePointsEveryDay) return;
    const next = new Set(pointDaysMeta.active);
    for (const p of route.points) {
      const key = `${p.id}:${dayOfWeek}`;
      if (selected) next.add(key);
      else next.delete(key);
    }
    setPointDaysForm({ ...pointDaysMeta, active: next });
  }

  const savePointDays = useMutation({
    mutationFn: async () => {
      if (!pointDaysMeta) return;
      const assignments = pointDaysMeta.samePointsEveryDay
        ? []
        : [...pointDaysMeta.active].map((key) => {
            const [pointId, dayStr] = key.split(":");
            return { pointId, dayOfWeek: Number(dayStr) };
          });
      const res = await fetch(`/api/admin/patrol/routes/${id}/point-days`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          samePointsEveryDay: pointDaysMeta.samePointsEveryDay,
          assignments,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? "Error al guardar puntos por día");
    },
    onSuccess: () => {
      toast.success("Puntos por día actualizados");
      setPointDaysForm(null);
      qc.invalidateQueries({ queryKey: ["patrol-route", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const { data: locationsData } = useQuery<{ data: Location[] }>({
    queryKey: ["patrol-contract-locations", meta?.contractId],
    queryFn: () =>
      fetch(`/api/admin/patrol/contracts/${meta!.contractId}/locations`).then((r) => r.json()),
    enabled: !!meta?.contractId,
  });

  const { data: positionsData } = useQuery<{ data: Position[] }>({
    queryKey: ["patrol-location-positions", meta?.locationId],
    queryFn: () =>
      fetch(`/api/admin/patrol/locations/${meta!.locationId}/positions`).then((r) => r.json()),
    enabled: !!meta?.locationId,
  });

  function updateRouteForm(patch: Partial<RouteForm>) {
    if (!meta) return;
    const next = { ...meta, ...patch };
    if (patch.contractId !== undefined && patch.contractId !== meta.contractId) {
      next.locationId = "";
      next.positionId = "";
    }
    if (patch.locationId !== undefined && patch.locationId !== meta.locationId) {
      next.positionId = "";
    }
    setRouteForm(next);
  }

  const saveRoute = useMutation({
    mutationFn: async () => {
      if (!meta) return;
      const res = await fetch(`/api/admin/patrol/routes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: meta.name,
          isActive: meta.isActive,
          contractId: meta.contractId.trim() || null,
          locationId: meta.locationId.trim() || null,
          positionId: meta.positionId.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar ruta");
    },
    onSuccess: () => {
      toast.success("Ruta actualizada");
      setRouteForm(null);
      qc.invalidateQueries({ queryKey: ["patrol-route", id] });
    },
    onError: () => toast.error("Error al guardar"),
  });

  const saveSchedule = useMutation({
    mutationFn: async () => {
      if (!scheduleMeta) return;
      const res = await fetch(`/api/admin/patrol/routes/${id}/schedules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openSchedule: scheduleMeta.openSchedule,
          slots: scheduleMeta.slots,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Error al guardar horarios");
      }
    },
    onSuccess: () => {
      toast.success("Horarios actualizados");
      setScheduleForm(null);
      qc.invalidateQueries({ queryKey: ["patrol-route", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveWelfare = useMutation({
    mutationFn: async () => {
      if (!welfareMeta) return;
      const res = await fetch(`/api/admin/patrol/routes/${id}/welfare`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          welfareEnabled: welfareMeta.enabled,
          welfareIntervalMinutes: welfareMeta.intervalMinutes,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? "Error al guardar hombre vivo");
    },
    onSuccess: () => {
      toast.success("Configuración de hombre vivo guardada");
      setWelfareForm(null);
      qc.invalidateQueries({ queryKey: ["patrol-route", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const triggerWelfare = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/patrol/routes/${id}/welfare`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? "Error al disparar alerta");
      return j.data as { message?: string };
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? "Alerta enviada");
      qc.invalidateQueries({ queryKey: ["patrol-welfare-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addScheduleSlot(dayOfWeek: number) {
    if (!scheduleMeta) return;
    setScheduleForm({
      ...scheduleMeta,
      slots: [
        ...scheduleMeta.slots,
        { dayOfWeek, startTime: "06:00", endTime: "18:00", sortOrder: scheduleMeta.slots.length },
      ],
    });
  }

  function updateScheduleSlot(index: number, patch: Partial<ScheduleSlot>) {
    if (!scheduleMeta) return;
    const slots = scheduleMeta.slots.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setScheduleForm({ ...scheduleMeta, slots });
  }

  function removeScheduleSlot(index: number) {
    if (!scheduleMeta) return;
    setScheduleForm({
      ...scheduleMeta,
      slots: scheduleMeta.slots.filter((_, i) => i !== index),
    });
  }

  const savePoint = useMutation({
    mutationFn: async () => {
      const url = editingPoint
        ? `/api/admin/patrol/routes/${id}/points/${editingPoint.id}`
        : `/api/admin/patrol/routes/${id}/points`;
      const res = await fetch(url, {
        method: editingPoint ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: pointForm.code.trim(),
          name: pointForm.name.trim(),
          latitude: pointForm.latitude || null,
          longitude: pointForm.longitude || null,
          radiusM: Number(pointForm.radiusM) || 100,
          sortOrder: Number(pointForm.sortOrder) || 0,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar punto");
    },
    onSuccess: () => {
      toast.success(editingPoint ? "Punto actualizado" : "Punto agregado");
      setPointOpen(false);
      setEditingPoint(null);
      setPointForm(emptyPoint);
      qc.invalidateQueries({ queryKey: ["patrol-route", id] });
    },
    onError: () => toast.error("Error al guardar punto"),
  });

  const deletePoint = useMutation({
    mutationFn: async (pointId: string) => {
      const res = await fetch(`/api/admin/patrol/routes/${id}/points/${pointId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error al eliminar");
    },
    onSuccess: () => {
      toast.success("Punto eliminado");
      qc.invalidateQueries({ queryKey: ["patrol-route", id] });
    },
    onError: () => toast.error("Error al eliminar"),
  });

  function openPointEdit(p: Point) {
    setEditingPoint(p);
    setPointForm({
      code: p.code,
      name: p.name,
      latitude: p.latitude ?? "",
      longitude: p.longitude ?? "",
      radiusM: p.radiusM,
      sortOrder: p.sortOrder,
    });
    setPointOpen(true);
  }

  if (isLoading || !route || !meta || !scheduleMeta) {
    return <div className="p-8 text-sm text-muted-foreground">Cargando ruta…</div>;
  }

  const contractOptions = contractsData?.data ?? [];
  const contractSelectOptions = contractOptions.map((c) => ({
    value: c.id,
    label: `${c.licitacionNo} — ${c.client}`,
  }));
  const locationOptions = locationsData?.data ?? [];
  const locationSelectOptions = locationOptions.map((loc) => ({
    value: loc.id,
    label: loc.name,
  }));
  const positionOptions = positionsData?.data ?? [];
  const positionSelectOptions = positionOptions.map((pos) => ({
    value: pos.id,
    label: pos.name,
  }));

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/recorridos/rutas">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a rutas
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="font-mono">{route.code}</span>
            <Badge variant={meta.isActive ? "success" : "secondary"}>
              {meta.isActive ? "Activa" : "Inactiva"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 max-w-2xl">
          <div className="sm:col-span-2">
            <Label>Nombre</Label>
            <Input
              value={meta.name}
              onChange={(e) => updateRouteForm({ name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="route-contract">Contrato</Label>
            <SearchableSelect
              id="route-contract"
              value={meta.contractId}
              onChange={(contractId) => updateRouteForm({ contractId })}
              options={contractSelectOptions}
              placeholder="Seleccione contrato…"
              searchHint="Escriba licitación, cliente o palabras clave…"
              emptyMessage="No hay contratos que coincidan"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Escriba en el campo para buscar por licitación o nombre de cliente.
            </p>
          </div>
          <div>
            <Label htmlFor="route-location">Ubicación</Label>
            <SearchableSelect
              id="route-location"
              value={meta.locationId}
              onChange={(locationId) => updateRouteForm({ locationId })}
              options={locationSelectOptions}
              placeholder="Seleccione ubicación…"
              searchHint="Escriba nombre de ubicación…"
              emptyMessage="No hay ubicaciones que coincidan"
              disabled={!meta.contractId}
            />
          </div>
          <div>
            <Label htmlFor="route-position">Puesto</Label>
            <SearchableSelect
              id="route-position"
              value={meta.positionId}
              onChange={(positionId) => updateRouteForm({ positionId })}
              options={positionSelectOptions}
              placeholder="Seleccione puesto…"
              searchHint="Escriba nombre de puesto…"
              emptyMessage="No hay puestos que coincidan"
              disabled={!meta.locationId}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Contrato, ubicación y puesto identifican la ruta. Los celulares autorizados se gestionan
              en la pestaña{" "}
              <Link href={`/recorridos/rutas-permitidas/${id}`} className="underline">
                Rutas permitidas
              </Link>
              .
            </p>
          </div>
          <label className="flex items-end gap-2 text-sm pb-2">
            <input
              type="checkbox"
              checked={meta.isActive}
              onChange={(e) => updateRouteForm({ isActive: e.target.checked })}
            />
            Ruta activa
          </label>
          <div className="sm:col-span-2">
            <Button size="sm" onClick={() => saveRoute.mutate()} disabled={saveRoute.isPending}>
              Guardar ruta
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horarios de la ruta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-3xl">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={scheduleMeta.openSchedule}
              onChange={(e) =>
                setScheduleForm({ ...scheduleMeta, openSchedule: e.target.checked })
              }
            />
            Horario abierto (24 horas — el punto puede visitarse a cualquier hora)
          </label>

          {!scheduleMeta.openSchedule && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Defina los días y las franjas horarias en que la ruta se habilita. Puede agregar
                varias rondas por día (por ejemplo: 06:00–10:00 y 18:00–22:00).
              </p>
              {DAY_LABELS.map((dayLabel, dayOfWeek) => {
                const daySlots = scheduleMeta.slots
                  .map((s, index) => ({ ...s, index }))
                  .filter((s) => s.dayOfWeek === dayOfWeek);
                return (
                  <div key={dayOfWeek} className="rounded-md border px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{dayLabel}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addScheduleSlot(dayOfWeek)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Ronda
                      </Button>
                    </div>
                    {daySlots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Ruta deshabilitada este día</p>
                    ) : (
                      daySlots.map((slot) => (
                        <div key={slot.index} className="flex flex-wrap items-center gap-2">
                          <Input
                            type="time"
                            className="w-32"
                            value={slot.startTime}
                            onChange={(e) =>
                              updateScheduleSlot(slot.index, { startTime: e.target.value })
                            }
                          />
                          <span className="text-muted-foreground text-sm">a</span>
                          <Input
                            type="time"
                            className="w-32"
                            value={slot.endTime}
                            onChange={(e) =>
                              updateScheduleSlot(slot.index, { endTime: e.target.value })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeScheduleSlot(slot.index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Button size="sm" onClick={() => saveSchedule.mutate()} disabled={saveSchedule.isPending}>
            Guardar horarios
          </Button>
        </CardContent>
      </Card>

      {welfareMeta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HeartPulse className="h-4 w-4" />
              Hombre vivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-xl">
            <p className="text-sm text-muted-foreground">
              Alertas periódicas al guardia durante el horario de la ruta. El dispositivo consulta
              pendientes y confirma desde la app móvil.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={welfareMeta.enabled}
                onChange={(e) =>
                  setWelfareForm({ ...welfareMeta, enabled: e.target.checked })
                }
              />
              Habilitar hombre vivo en esta ruta
            </label>
            <div>
              <Label htmlFor="welfare-interval">Intervalo (minutos)</Label>
              <Input
                id="welfare-interval"
                type="number"
                min={5}
                max={480}
                value={welfareMeta.intervalMinutes}
                disabled={!welfareMeta.enabled}
                onChange={(e) =>
                  setWelfareForm({
                    ...welfareMeta,
                    intervalMinutes: Math.min(480, Math.max(5, Number(e.target.value) || 60)),
                  })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">Entre 5 y 480 minutos.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => saveWelfare.mutate()} disabled={saveWelfare.isPending}>
                Guardar configuración
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerWelfare.mutate()}
                disabled={triggerWelfare.isPending || !route.isActive}
              >
                Disparar alerta manual
              </Button>
              <Link href="/recorridos/hombre-vivo" className="text-sm text-primary underline self-center">
                Ver historial
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Puntos de marca ({route.points.length})</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditingPoint(null);
            setPointForm({ ...emptyPoint, sortOrder: route.points.length });
            setPointOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar punto
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Ord.</th>
                <th className="py-2 pr-3">Código / Tag NFC</th>
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Coords</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {route.points.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">{p.sortOrder + 1}</td>
                  <td className="py-2 pr-3 font-mono">{p.code}</td>
                  <td className="py-2 pr-3">{p.name}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {p.latitude && p.longitude ? `${p.latitude}, ${p.longitude}` : "—"}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => openPointEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deletePoint.mutate(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {pointDaysMeta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPinned className="h-4 w-4" />
              Puntos por día de la semana
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={pointDaysMeta.samePointsEveryDay}
                onChange={(e) => setSamePointsEveryDay(e.target.checked)}
              />
              <span>
                <span className="font-medium">Mismos puntos todos los días</span>
                <span className="block text-muted-foreground text-xs mt-0.5">
                  Si lo desmarca, puede quitar puntos que no aplican en cada día (p. ej. solo lunes a
                  viernes).
                </span>
              </span>
            </label>

            {!pointDaysMeta.samePointsEveryDay && (
              <div className="space-y-3">
                {route.points.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Agregue puntos de marca antes de configurar días.
                  </p>
                ) : (
                  DAY_LABELS.map((dayLabel, dayOfWeek) => {
                    const selectedCount = route.points.filter((p) =>
                      pointDaysMeta.active.has(`${p.id}:${dayOfWeek}`),
                    ).length;
                    const allSelected = selectedCount === route.points.length && route.points.length > 0;
                    return (
                      <div key={dayOfWeek} className="rounded-md border px-3 py-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {dayLabel}{" "}
                            <span className="text-muted-foreground font-normal">
                              ({selectedCount}/{route.points.length})
                            </span>
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setAllPointsForDay(dayOfWeek, true)}
                              disabled={allSelected}
                            >
                              Todos
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setAllPointsForDay(dayOfWeek, false)}
                              disabled={selectedCount === 0}
                            >
                              Ninguno
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {route.points.map((p) => {
                            const key = `${p.id}:${dayOfWeek}`;
                            const checked = pointDaysMeta.active.has(key);
                            return (
                              <label
                                key={key}
                                className="flex items-center gap-2 text-sm rounded border px-2 py-1.5 cursor-pointer hover:bg-muted/40"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePointDay(p.id, dayOfWeek)}
                                />
                                <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                                <span className="truncate">{p.name}</span>
                              </label>
                            );
                          })}
                        </div>
                        {selectedCount === 0 && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Sin puntos este día: la ruta no exigirá marcas.
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <Button
              size="sm"
              onClick={() => savePointDays.mutate()}
              disabled={savePointDays.isPending || route.points.length === 0}
            >
              Guardar puntos por día
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={pointOpen} onOpenChange={setPointOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPoint ? "Editar punto" : "Nuevo punto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Código / Tag NFC</Label>
              <Input
                value={pointForm.code}
                onChange={(e) => setPointForm({ ...pointForm, code: e.target.value.toUpperCase() })}
                placeholder="P01"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Mismo identificador en la app y en el chip NFC físico.
              </p>
            </div>
            <div>
              <Label>Orden</Label>
              <Input
                type="number"
                value={pointForm.sortOrder}
                onChange={(e) =>
                  setPointForm({ ...pointForm, sortOrder: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Nombre</Label>
              <Input
                value={pointForm.name}
                onChange={(e) => setPointForm({ ...pointForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Latitud</Label>
              <Input
                value={pointForm.latitude}
                onChange={(e) => setPointForm({ ...pointForm, latitude: e.target.value })}
              />
            </div>
            <div>
              <Label>Longitud</Label>
              <Input
                value={pointForm.longitude}
                onChange={(e) => setPointForm({ ...pointForm, longitude: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPointOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => savePoint.mutate()} disabled={savePoint.isPending}>
              Guardar punto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
