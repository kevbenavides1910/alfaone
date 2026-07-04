"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Smartphone, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/components/ui/toaster";

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

type RoutePhonesData = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  phones: RoutePhone[];
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

function phoneContextLabel(phone: {
  contractName: string | null;
  locationName: string | null;
  positionName: string | null;
}) {
  const parts = [phone.contractName, phone.locationName, phone.positionName].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Sin puesto asignado en inventario";
}

export function RoutePhonesPanel({ routeId }: { routeId: string }) {
  const qc = useQueryClient();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [primaryPhoneOpen, setPrimaryPhoneOpen] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState("");
  const [primaryPhoneSearch, setPrimaryPhoneSearch] = useState("");
  const [selectedPhoneAssetId, setSelectedPhoneAssetId] = useState("");
  const [selectedPrimaryPhoneAssetId, setSelectedPrimaryPhoneAssetId] = useState("");

  const { data, isLoading } = useQuery<{ data: RoutePhonesData }>({
    queryKey: ["patrol-route", routeId],
    queryFn: () => fetch(`/api/admin/patrol/routes/${routeId}`).then((r) => r.json()),
  });

  const { data: availablePhonesData } = useQuery<{ data: AvailablePhone[] }>({
    queryKey: ["patrol-route-available-phones", routeId],
    queryFn: () => fetch(`/api/admin/patrol/routes/${routeId}/phones`).then((r) => r.json()),
    enabled: phoneOpen || primaryPhoneOpen,
  });

  const addPhone = useMutation({
    mutationFn: async ({
      assetId,
      isPrimary = false,
    }: {
      assetId: string;
      isPrimary?: boolean;
    }) => {
      const res = await fetch(`/api/admin/patrol/routes/${routeId}/phones`, {
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
      await qc.refetchQueries({ queryKey: ["patrol-route", routeId] });
      qc.invalidateQueries({ queryKey: ["patrol-route-available-phones", routeId] });
      qc.invalidateQueries({ queryKey: ["patrol-routes-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePhone = useMutation({
    mutationFn: async (phoneId: string) => {
      const res = await fetch(`/api/admin/patrol/routes/${routeId}/phones/${phoneId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Error al quitar teléfono");
      }
    },
    onSuccess: () => {
      toast.success("Teléfono removido");
      qc.invalidateQueries({ queryKey: ["patrol-route", routeId] });
      qc.invalidateQueries({ queryKey: ["patrol-route-available-phones", routeId] });
      qc.invalidateQueries({ queryKey: ["patrol-routes-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPrimary = useMutation({
    mutationFn: async (phoneId: string) => {
      const res = await fetch(`/api/admin/patrol/routes/${routeId}/phones/${phoneId}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Error al establecer principal");
    },
    onSuccess: () => {
      toast.success("Celular principal actualizado");
      qc.invalidateQueries({ queryKey: ["patrol-route", routeId] });
    },
    onError: () => toast.error("Error al establecer principal"),
  });

  if (isLoading || !data?.data) {
    return <div className="text-sm text-muted-foreground">Cargando celulares…</div>;
  }

  const route = data.data;
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
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Celulares autorizados — {route.code}
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
                  <Button variant="outline" size="sm" onClick={() => setPrimaryPhoneOpen(true)}>
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
                  Asigne el celular que usará la app SYNTRA en esta ruta (por IMEI).
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
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {!primaryPhone ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPrimary.mutate(phone.id)}
                        disabled={setPrimary.isPending}
                      >
                        Hacer principal
                      </Button>
                    ) : null}
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
                celulares adicionales del inventario.
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
                placeholder="Ej. 000000000000001…"
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
                placeholder="Ej. 000000000000002…"
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
    </>
  );
}
