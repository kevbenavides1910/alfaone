"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, Smartphone, Star, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

type RoutePhone = {
  id: string;
  assetId: string;
  isPrimary: boolean;
  imei: string;
  phoneLabel: string;
  positionName: string | null;
  locationName: string | null;
  contractName: string | null;
};

type AvailablePhone = {
  assetId: string;
  imei: string;
  phoneLabel: string;
  positionName: string | null;
  locationName: string | null;
  contractName: string | null;
};

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
  schedules: ScheduleSlot[];
  points: Point[];
  phones: RoutePhone[];
};

type RouteForm = {
  name: string;
  isActive: boolean;
  contractId: string;
  locationId: string;
  positionId: string;
};

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const emptyPoint = {
  code: "",
  name: "",
  nfcTagCode: "",
  latitude: "",
  longitude: "",
  radiusM: 100,
  sortOrder: 0,
};

function phoneContextLabel(phone: {
  contractName: string | null;
  locationName: string | null;
  positionName: string | null;
}) {
  const parts = [phone.contractName, phone.locationName, phone.positionName].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Sin puesto asignado en inventario";
}

export default function RecorridosRutaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [pointOpen, setPointOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState("");
  const [selectedPhoneAssetId, setSelectedPhoneAssetId] = useState("");
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);
  const [pointForm, setPointForm] = useState(emptyPoint);
  const [routeForm, setRouteForm] = useState<RouteForm | null>(null);
  const [scheduleForm, setScheduleForm] = useState<{
    openSchedule: boolean;
    slots: ScheduleSlot[];
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

  const { data: availablePhonesData } = useQuery<{ data: AvailablePhone[] }>({
    queryKey: ["patrol-route-available-phones", id],
    queryFn: () => fetch(`/api/admin/patrol/routes/${id}/phones`).then((r) => r.json()),
    enabled: phoneOpen,
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
      qc.invalidateQueries({ queryKey: ["patrol-route-available-phones", id] });
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

  const addPhone = useMutation({
    mutationFn: async (assetId: string) => {
      const res = await fetch(`/api/admin/patrol/routes/${id}/phones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Error al autorizar teléfono");
      }
    },
    onSuccess: async () => {
      toast.success("Teléfono autorizado");
      setPhoneOpen(false);
      setSelectedPhoneAssetId("");
      setPhoneSearch("");
      await qc.refetchQueries({ queryKey: ["patrol-route", id] });
      qc.invalidateQueries({ queryKey: ["patrol-route-available-phones", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePhone = useMutation({
    mutationFn: async (phoneId: string) => {
      const res = await fetch(`/api/admin/patrol/routes/${id}/phones/${phoneId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Error al quitar teléfono");
      }
    },
    onSuccess: () => {
      toast.success("Teléfono removido");
      qc.invalidateQueries({ queryKey: ["patrol-route", id] });
      qc.invalidateQueries({ queryKey: ["patrol-route-available-phones", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPrimary = useMutation({
    mutationFn: async (phoneId: string) => {
      const res = await fetch(`/api/admin/patrol/routes/${id}/phones/${phoneId}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Error al establecer principal");
    },
    onSuccess: () => {
      toast.success("Celular principal actualizado");
      qc.invalidateQueries({ queryKey: ["patrol-route", id] });
    },
    onError: () => toast.error("Error al establecer principal"),
  });

  const savePoint = useMutation({
    mutationFn: async () => {
      const url = editingPoint
        ? `/api/admin/patrol/routes/${id}/points/${editingPoint.id}`
        : `/api/admin/patrol/routes/${id}/points`;
      const res = await fetch(url, {
        method: editingPoint ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pointForm,
          nfcTagCode: pointForm.nfcTagCode || null,
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
      nfcTagCode: p.nfcTagCode ?? "",
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
  const locationOptions = locationsData?.data ?? [];
  const positionOptions = positionsData?.data ?? [];
  const availablePhones = (availablePhonesData?.data ?? []).filter((p) => {
    const q = phoneSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.phoneLabel.toLowerCase().includes(q) ||
      p.imei.toLowerCase().includes(q) ||
      (p.contractName ?? "").toLowerCase().includes(q) ||
      (p.positionName ?? "").toLowerCase().includes(q)
    );
  });
  const authorizedPhones = route.phones ?? [];
  const primaryPhone = authorizedPhones.find((p) => p.isPrimary);
  const supportPhones = authorizedPhones.filter((p) => !p.isPrimary);

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
            <Label>Contrato</Label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background"
              value={meta.contractId}
              onChange={(e) => updateRouteForm({ contractId: e.target.value })}
            >
              <option value="">Seleccione contrato…</option>
              {contractOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.licitacionNo} — {c.client}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Ubicación</Label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background"
              value={meta.locationId}
              disabled={!meta.contractId}
              onChange={(e) => updateRouteForm({ locationId: e.target.value })}
            >
              <option value="">Seleccione ubicación…</option>
              {locationOptions.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Puesto</Label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background"
              value={meta.positionId}
              disabled={!meta.locationId}
              onChange={(e) => updateRouteForm({ positionId: e.target.value })}
            >
              <option value="">Seleccione puesto…</option>
              {positionOptions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Al guardar, el celular asignado a ese puesto en inventario queda como principal.
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
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Celulares autorizados
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setPhoneOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar teléfono de apoyo
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border px-3 py-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Celular principal (puesto asignado)
            </p>
            {!meta.positionId ? (
              primaryPhone ? (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{primaryPhone.phoneLabel}</p>
                    <p className="text-muted-foreground">{phoneContextLabel(primaryPhone)}</p>
                    <p className="text-xs text-muted-foreground">IMEI {primaryPhone.imei || "—"}</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Seleccione ubicación y puesto arriba, o use un teléfono de apoyo mientras
                      tanto.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="success">
                      <Star className="h-3 w-3 mr-1" />
                      Principal
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-8"
                      onClick={() => removePhone.mutate(primaryPhone.id)}
                      disabled={removePhone.isPending}
                    >
                      Quitar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Seleccione contrato, ubicación y puesto para vincular el celular principal del
                  inventario, o agregue un teléfono de apoyo abajo.
                </p>
              )
            ) : primaryPhone ? (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{primaryPhone.phoneLabel}</p>
                  <p className="text-muted-foreground">{phoneContextLabel(primaryPhone)}</p>
                  <p className="text-xs text-muted-foreground">IMEI {primaryPhone.imei || "—"}</p>
                </div>
                <Badge variant="success" className="shrink-0">
                  <Star className="h-3 w-3 mr-1" />
                  Principal
                </Badge>
              </div>
            ) : (
              <p className="text-muted-foreground">
                No hay celular en inventario para el puesto seleccionado. Asigne un teléfono al
                puesto en inventario y guarde la ruta.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Teléfonos de apoyo ({supportPhones.length})
            </p>
            {supportPhones.length > 0 ? (
              supportPhones.map((phone) => (
                <div
                  key={phone.id}
                  className="rounded-md border px-3 py-3 text-sm flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="font-medium">{phone.phoneLabel}</p>
                    <p className="text-muted-foreground">{phoneContextLabel(phone)}</p>
                    <p className="text-xs text-muted-foreground">IMEI {phone.imei || "—"}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPrimary.mutate(phone.id)}
                      disabled={setPrimary.isPending}
                    >
                      Hacer principal
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePhone.mutate(phone.id)}
                      disabled={removePhone.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-4">
                No hay teléfonos de apoyo. Use &quot;Agregar teléfono de apoyo&quot; para autorizar
                celulares de cualquier inventario.
              </p>
            )}
          </div>

          {authorizedPhones.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {authorizedPhones.length} celular(es) autorizado(s) en esta ruta.
            </p>
          ) : null}
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
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Tag NFC</th>
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
                  <td className="py-2 pr-3 font-mono text-xs">{p.nfcTagCode ?? "—"}</td>
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

      <Dialog open={phoneOpen} onOpenChange={setPhoneOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Autorizar teléfono de apoyo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Buscar celular</Label>
              <Input
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                placeholder="IMEI, nombre, contrato o puesto…"
              />
            </div>
            <div>
              <Label>Celular (todo el inventario)</Label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background"
                value={selectedPhoneAssetId}
                onChange={(e) => setSelectedPhoneAssetId(e.target.value)}
              >
                <option value="">Seleccione un celular…</option>
                {availablePhones.map((p) => (
                  <option key={p.assetId} value={p.assetId}>
                    {p.phoneLabel}
                    {p.contractName ? ` — ${p.contractName}` : ""}
                    {p.positionName ? ` / ${p.positionName}` : ""}
                    {p.imei ? ` (IMEI ${p.imei})` : ""}
                  </option>
                ))}
              </select>
              {availablePhones.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  No hay más celulares disponibles en inventario.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => addPhone.mutate(selectedPhoneAssetId)}
              disabled={!selectedPhoneAssetId || addPhone.isPending}
            >
              Autorizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pointOpen} onOpenChange={setPointOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPoint ? "Editar punto" : "Nuevo punto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Código punto</Label>
              <Input
                value={pointForm.code}
                onChange={(e) => setPointForm({ ...pointForm, code: e.target.value })}
              />
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
            <div className="sm:col-span-2">
              <Label>Tag NFC</Label>
              <Input
                value={pointForm.nfcTagCode}
                onChange={(e) => setPointForm({ ...pointForm, nfcTagCode: e.target.value })}
                placeholder="TAG-DEMO-01"
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
