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

function phoneOptionLabel(phone: AvailablePhone) {
  const parts = [phone.phoneLabel];
  if (phone.imei) parts.push(`IMEI ${phone.imei}`);
  if (phone.contractName) parts.push(phone.contractName);
  if (phone.positionName) parts.push(phone.positionName);
  return parts.join(" · ");
}

function filterPhones(phones: AvailablePhone[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return phones;
  return phones.filter((phone) => {
    const haystack = [
      phone.phoneLabel,
      phone.imei,
      phone.contractName ?? "",
      phone.locationName ?? "",
      phone.positionName ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return q.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
  });
}

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const emptyPoint = {
  code: "",
  name: "",
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
  const [primaryPhoneOpen, setPrimaryPhoneOpen] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState("");
  const [primaryPhoneSearch, setPrimaryPhoneSearch] = useState("");
  const [selectedPhoneAssetId, setSelectedPhoneAssetId] = useState("");
  const [selectedPrimaryPhoneAssetId, setSelectedPrimaryPhoneAssetId] = useState("");
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
    enabled: phoneOpen || primaryPhoneOpen,
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
    mutationFn: async ({
      assetId,
      isPrimary = false,
    }: {
      assetId: string;
      isPrimary?: boolean;
    }) => {
      const res = await fetch(`/api/admin/patrol/routes/${id}/phones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, isPrimary }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Error al autorizar teléfono");
      }
    },
    onSuccess: async (_, variables) => {
      toast.success(variables.isPrimary ? "Celular principal asignado" : "Teléfono autorizado");
      setPhoneOpen(false);
      setPrimaryPhoneOpen(false);
      setSelectedPhoneAssetId("");
      setSelectedPrimaryPhoneAssetId("");
      setPhoneSearch("");
      setPrimaryPhoneSearch("");
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
  const availablePhones = filterPhones(availablePhonesData?.data ?? [], phoneSearch);
  const availablePrimaryPhones = filterPhones(
    availablePhonesData?.data ?? [],
    primaryPhoneSearch,
  );
  const phoneSelectOptions = availablePhones.map((phone) => ({
    value: phone.assetId,
    label: phoneOptionLabel(phone),
  }));
  const primaryPhoneSelectOptions = availablePrimaryPhones.map((phone) => ({
    value: phone.assetId,
    label: phoneOptionLabel(phone),
  }));
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
              Contrato, ubicación y puesto identifican la ruta. El celular se asigna manualmente abajo.
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
              Celular principal
            </p>
            {primaryPhone ? (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{primaryPhone.phoneLabel}</p>
                  <p className="text-muted-foreground">{phoneContextLabel(primaryPhone)}</p>
                  <p className="text-xs text-muted-foreground">IMEI {primaryPhone.imei || "—"}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="success">
                    <Star className="h-3 w-3 mr-1" />
                    Principal
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPrimaryPhoneOpen(true)}
                  >
                    Cambiar
                  </Button>
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
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Asigne cualquier celular del inventario por IMEI. No importa a qué puesto esté
                  asignado en inventario.
                </p>
                <Button size="sm" onClick={() => setPrimaryPhoneOpen(true)}>
                  Asignar celular principal
                </Button>
              </div>
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

      <Dialog open={primaryPhoneOpen} onOpenChange={setPrimaryPhoneOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Asignar celular principal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Buscar por IMEI, nombre o contrato</Label>
              <Input
                value={primaryPhoneSearch}
                onChange={(e) => setPrimaryPhoneSearch(e.target.value)}
                placeholder="Ej. 000000000000002, HONOR, Administrativo…"
              />
            </div>
            <div>
              <Label>Celular del inventario</Label>
              <SearchableSelect
                value={selectedPrimaryPhoneAssetId}
                onChange={setSelectedPrimaryPhoneAssetId}
                options={primaryPhoneSelectOptions}
                placeholder="Seleccione un celular…"
                searchHint="Escriba IMEI, nombre o contrato…"
                emptyMessage="No hay celulares que coincidan"
              />
              {primaryPhoneSelectOptions.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  No hay celulares disponibles. Verifique que estén en inventario con IMEI y que no
                  estén ya autorizados en esta ruta.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrimaryPhoneOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                addPhone.mutate({
                  assetId: selectedPrimaryPhoneAssetId,
                  isPrimary: true,
                })
              }
              disabled={!selectedPrimaryPhoneAssetId || addPhone.isPending}
            >
              Asignar principal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={phoneOpen} onOpenChange={setPhoneOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Autorizar teléfono de apoyo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Buscar por IMEI, nombre o contrato</Label>
              <Input
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                placeholder="Ej. 000000000000002, HONOR, Administrativo…"
              />
            </div>
            <div>
              <Label>Celular (todo el inventario)</Label>
              <SearchableSelect
                value={selectedPhoneAssetId}
                onChange={setSelectedPhoneAssetId}
                options={phoneSelectOptions}
                placeholder="Seleccione un celular…"
                searchHint="Escriba IMEI, nombre o contrato…"
                emptyMessage="No hay celulares que coincidan"
              />
              {phoneSelectOptions.length === 0 && (
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
              onClick={() => addPhone.mutate({ assetId: selectedPhoneAssetId })}
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
