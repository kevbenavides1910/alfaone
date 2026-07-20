"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Building2,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  User,
  Receipt,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatBillingPeriodRange } from "@/lib/utils/format";
import {
  administrationUsesContractBillingPeriod,
  resolveAdministrationBillingPeriod,
} from "@/modules/presupuestos/business/administration-billing-period";
import { sumAdministrationBillingLines } from "@/modules/presupuestos/business/administration-billing-amount";
import {
  contractBillingLineSchema,
  contractAdministrationSchema,
  type ContractBillingLineInput,
  type ContractAdministrationInput,
} from "@/modules/presupuestos/validations/contract.schema";

interface BillingLine {
  id: string;
  lineCode: string;
  description: string;
  monthlyAmount: number | null;
  sortOrder: number;
}

interface Administration {
  id: string;
  name: string;
  managerName: string;
  managerEmail: string | null;
  managerPhone: string | null;
  zoneId: string | null;
  zoneName: string | null;
  billingPeriodFromDay: number | null;
  billingPeriodToDay: number | null;
  billingLineIds: string[];
  billingLines: { billingLineId: string; monthlyAmount: number | null }[];
  sortOrder: number;
}

interface ZoneOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface Props {
  contractId: string;
  readOnly?: boolean;
}

const emptyLineForm: ContractBillingLineInput = {
  lineCode: "",
  description: "",
  monthlyAmount: undefined,
};

export function AdministrationsTab({ contractId, readOnly }: Props) {
  const qc = useQueryClient();
  const [lineOpen, setLineOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<BillingLine | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Administration | null>(null);
  const [useContractPeriod, setUseContractPeriod] = useState(true);
  const [countDraft, setCountDraft] = useState("1");

  const { data: contractRes } = useQuery<{
    data: {
      administrationsCount?: number;
      billingPeriodFromDay?: number;
      billingPeriodToDay?: number;
    };
  }>({
    queryKey: ["contract", contractId],
    queryFn: () => fetch(`/api/contracts/${contractId}`).then((r) => r.json()),
  });

  const administrationsCount = contractRes?.data?.administrationsCount ?? 1;
  const contractBillingPeriod = {
    billingPeriodFromDay: contractRes?.data?.billingPeriodFromDay ?? 1,
    billingPeriodToDay: contractRes?.data?.billingPeriodToDay ?? 31,
  };

  useEffect(() => {
    setCountDraft(String(administrationsCount));
  }, [administrationsCount]);

  const { data: linesData, isLoading: linesLoading } = useQuery<{ data: BillingLine[] }>({
    queryKey: ["contract-billing-lines", contractId],
    queryFn: () => fetch(`/api/contracts/${contractId}/billing-lines`).then((r) => r.json()),
  });

  const { data: adminsData, isLoading: adminsLoading } = useQuery<{
    data: { administrationsCount: number; administrations: Administration[] };
  }>({
    queryKey: ["contract-administrations", contractId],
    queryFn: () => fetch(`/api/contracts/${contractId}/administrations`).then((r) => r.json()),
  });

  const { data: zonesData } = useQuery<{ data: ZoneOption[] }>({
    queryKey: ["zones-catalog"],
    queryFn: () => fetch("/api/admin/catalogs/zones").then((r) => r.json()),
  });

  const billingLines = linesData?.data ?? [];
  const administrations = adminsData?.data?.administrations ?? [];
  const zones = (zonesData?.data ?? []).filter((z) => z.isActive);

  const {
    register: registerLine,
    handleSubmit: handleSubmitLine,
    reset: resetLine,
    formState: { errors: lineErrors },
  } = useForm<ContractBillingLineInput>({
    resolver: zodResolver(contractBillingLineSchema),
    defaultValues: emptyLineForm,
  });

  const {
    register: registerAdmin,
    handleSubmit: handleSubmitAdmin,
    reset: resetAdmin,
    setValue: setAdminValue,
    watch: watchAdmin,
    formState: { errors: adminErrors },
  } = useForm<ContractAdministrationInput>({
    resolver: zodResolver(contractAdministrationSchema),
    defaultValues: {
      name: "",
      managerName: "",
      managerEmail: "",
      managerPhone: "",
      zoneId: null,
      billingLineIds: [],
      billingLines: [],
      billingPeriodFromDay: null,
      billingPeriodToDay: null,
    },
  });

  const selectedBillingLines = watchAdmin("billingLines") ?? [];
  const selectedLineIds = selectedBillingLines.map((l) => l.billingLineId);

  const saveCountMutation = useMutation({
    mutationFn: async (count: number) => {
      const r = await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ administrationsCount: count }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract", contractId] });
      qc.invalidateQueries({ queryKey: ["contract-administrations", contractId] });
      toast.success("Cantidad de administraciones actualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveLineMutation = useMutation({
    mutationFn: async (payload: ContractBillingLineInput) => {
      const url = editingLine
        ? `/api/contracts/${contractId}/billing-lines/${editingLine.id}`
        : `/api/contracts/${contractId}/billing-lines`;
      const r = await fetch(url, {
        method: editingLine ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-billing-lines", contractId] });
      toast.success(editingLine ? "Línea actualizada" : "Línea agregada");
      closeLineDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLineMutation = useMutation({
    mutationFn: async (lineId: string) => {
      const r = await fetch(`/api/contracts/${contractId}/billing-lines/${lineId}`, {
        method: "DELETE",
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al eliminar");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-billing-lines", contractId] });
      qc.invalidateQueries({ queryKey: ["contract-administrations", contractId] });
      toast.success("Línea eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAdminMutation = useMutation({
    mutationFn: async (payload: ContractAdministrationInput) => {
      if (!editingAdmin) throw new Error("Administración no seleccionada");
      const r = await fetch(`/api/contracts/${contractId}/administrations/${editingAdmin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          zoneId: payload.zoneId || null,
          managerEmail: payload.managerEmail?.trim() || undefined,
          billingPeriodFromDay: useContractPeriod ? null : payload.billingPeriodFromDay ?? null,
          billingPeriodToDay: useContractPeriod ? null : payload.billingPeriodToDay ?? null,
          billingLines: payload.billingLines,
        }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-administrations", contractId] });
      toast.success("Administración actualizada");
      closeAdminDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreateLine() {
    setEditingLine(null);
    resetLine(emptyLineForm);
    setLineOpen(true);
  }

  function openEditLine(row: BillingLine) {
    setEditingLine(row);
    resetLine({
      lineCode: row.lineCode,
      description: row.description,
      monthlyAmount: row.monthlyAmount ?? undefined,
    });
    setLineOpen(true);
  }

  function closeLineDialog() {
    setLineOpen(false);
    setEditingLine(null);
    resetLine(emptyLineForm);
  }

  function openEditAdmin(row: Administration) {
    setEditingAdmin(row);
    const inherits = administrationUsesContractBillingPeriod(row);
    setUseContractPeriod(inherits);
    const resolved = resolveAdministrationBillingPeriod(row, contractBillingPeriod);
    resetAdmin({
      name: row.name,
      managerName: row.managerName,
      managerEmail: row.managerEmail ?? "",
      managerPhone: row.managerPhone ?? "",
      zoneId: row.zoneId,
      billingLineIds: row.billingLineIds,
      billingLines: row.billingLines.length > 0
        ? row.billingLines
        : row.billingLineIds.map((id) => ({ billingLineId: id, monthlyAmount: null })),
      billingPeriodFromDay: inherits ? resolved.fromDay : row.billingPeriodFromDay,
      billingPeriodToDay: inherits ? resolved.toDay : row.billingPeriodToDay,
    });
    setAdminOpen(true);
  }

  function formatAdminBillingPeriod(admin: Administration) {
    const resolved = resolveAdministrationBillingPeriod(admin, contractBillingPeriod);
    const label = formatBillingPeriodRange(resolved.fromDay, resolved.toDay);
    if (administrationUsesContractBillingPeriod(admin)) {
      return `${label} (del contrato)`;
    }
    return label;
  }

  function closeAdminDialog() {
    setAdminOpen(false);
    setEditingAdmin(null);
  }

  function toggleBillingLine(lineId: string) {
    const current = selectedBillingLines;
    const exists = current.find((l) => l.billingLineId === lineId);
    const next = exists
      ? current.filter((l) => l.billingLineId !== lineId)
      : [...current, { billingLineId: lineId, monthlyAmount: null }];
    setAdminValue("billingLines", next, { shouldValidate: true });
    setAdminValue("billingLineIds", next.map((l) => l.billingLineId), { shouldValidate: true });
  }

  function setBillingLineAmount(lineId: string, raw: string) {
    const amount = raw === "" ? null : Number(raw);
    const next = selectedBillingLines.map((l) =>
      l.billingLineId === lineId
        ? { ...l, monthlyAmount: amount != null && Number.isFinite(amount) ? amount : null }
        : l
    );
    setAdminValue("billingLines", next, { shouldValidate: true });
  }

  function adminMonthlyTotal(admin: Administration): number | null {
    return sumAdministrationBillingLines({
      id: admin.id,
      billingLines: admin.billingLines.map((l) => {
        const contractLine = billingLines.find((bl) => bl.id === l.billingLineId);
        return {
          billingLineId: l.billingLineId,
          monthlyAmount: l.monthlyAmount,
          billingLine: contractLine ? { monthlyAmount: contractLine.monthlyAmount } : null,
        };
      }),
    });
  }

  function handleSaveCount() {
    const n = parseInt(countDraft, 10);
    if (Number.isNaN(n) || n < 1 || n > 20) {
      toast.error("Indique entre 1 y 20 administraciones");
      return;
    }
    if (n === administrationsCount) return;
    saveCountMutation.mutate(n);
  }

  const loading = linesLoading || adminsLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Administraciones del contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Indique cuántas administraciones del cliente facturan por separado en este contrato.
            Cada una debe tener encargado, zona y las líneas de facturación que le corresponden.
          </p>
          <div className="flex flex-wrap items-end gap-3 max-w-md">
            <div className="space-y-1.5 flex-1 min-w-[140px]">
              <Label htmlFor="administrationsCount">Cantidad de administraciones</Label>
              <Input
                id="administrationsCount"
                type="number"
                min={1}
                max={20}
                value={countDraft}
                disabled={readOnly || saveCountMutation.isPending}
                onChange={(e) => setCountDraft(e.target.value)}
              />
            </div>
            {!readOnly && (
              <Button
                type="button"
                variant="secondary"
                disabled={saveCountMutation.isPending || countDraft === String(administrationsCount)}
                onClick={handleSaveCount}
              >
                {saveCountMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Aplicar"
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Líneas de facturación
          </CardTitle>
          {!readOnly && (
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={openCreateLine}>
              <Plus className="h-3.5 w-3.5" /> Agregar línea
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!loading && billingLines.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay líneas definidas. Agregue las partidas o líneas del contrato que se facturan a cada administración.
            </p>
          )}
          {billingLines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Código</th>
                    <th className="py-2 pr-3 font-medium">Descripción</th>
                    <th className="py-2 pr-3 font-medium text-right">Monto mensual</th>
                    {!readOnly && <th className="py-2 w-24" />}
                  </tr>
                </thead>
                <tbody>
                  {billingLines.map((line) => (
                    <tr key={line.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">{line.lineCode}</td>
                      <td className="py-2 pr-3">{line.description}</td>
                      <td className="py-2 pr-3 text-right">
                        {line.monthlyAmount != null ? formatCurrency(line.monthlyAmount) : "—"}
                      </td>
                      {!readOnly && (
                        <td className="py-2">
                          <div className="flex gap-1 justify-end">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openEditLine(line)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-600"
                              onClick={() => {
                                if (confirm("¿Eliminar esta línea de facturación?")) {
                                  deleteLineMutation.mutate(line.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {administrationsCount > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalle por administración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {administrations.map((admin, idx) => {
              const assignedLines = billingLines.filter((l) => admin.billingLineIds.includes(l.id));
              const monthlyTotal = adminMonthlyTotal(admin);
              return (
                <div key={admin.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{admin.name || `Administración ${idx + 1}`}</p>
                      <p className="text-xs text-muted-foreground">Administración {idx + 1} de {administrationsCount}</p>
                      {monthlyTotal != null && (
                        <p className="text-sm font-medium mt-1">Monto mensual: {formatCurrency(monthlyTotal)}</p>
                      )}
                    </div>
                    {!readOnly && (
                      <Button type="button" size="sm" variant="outline" onClick={() => openEditAdmin(admin)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex gap-2">
                      <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Encargado</p>
                        <p>{admin.managerName || "—"}</p>
                        {admin.managerEmail && (
                          <p className="text-xs text-muted-foreground">{admin.managerEmail}</p>
                        )}
                        {admin.managerPhone && (
                          <p className="text-xs text-muted-foreground">{admin.managerPhone}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Zona</p>
                        <p>{admin.zoneName || "—"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Líneas facturadas</p>
                      {assignedLines.length === 0 ? (
                        <p className="text-muted-foreground">Ninguna asignada</p>
                      ) : (
                        <ul className="space-y-0.5">
                          {assignedLines.map((l) => {
                            const link = admin.billingLines.find((bl) => bl.billingLineId === l.id);
                            const amt = link?.monthlyAmount ?? l.monthlyAmount;
                            return (
                              <li key={l.id}>
                                <span className="font-mono text-xs">{l.lineCode}</span>
                                {" — "}
                                {l.description}
                                {amt != null && (
                                  <span className="text-muted-foreground"> ({formatCurrency(amt)})</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-muted-foreground">Periodo facturado</p>
                    <p>{formatAdminBillingPeriod(admin)}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {administrationsCount === 1 && administrations[0] && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Administración única</CardTitle>
            {!readOnly && (
              <Button type="button" size="sm" variant="outline" onClick={() => openEditAdmin(administrations[0])}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Encargado</p>
              <p>{administrations[0].managerName || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Zona</p>
              <p>{administrations[0].zoneName || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Líneas</p>
              <p>
                {administrations[0].billingLineIds.length > 0
                  ? `${administrations[0].billingLineIds.length} línea(s)`
                  : "Todas / sin asignar"}
              </p>
            </div>
            <div className="md:col-span-3">
              <p className="text-xs text-muted-foreground">Periodo facturado</p>
              <p>{formatAdminBillingPeriod(administrations[0])}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={lineOpen && !readOnly} onOpenChange={(v) => { if (!v) closeLineDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLine ? "Editar línea" : "Nueva línea de facturación"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitLine((v) => saveLineMutation.mutate(v))} className="space-y-4">
            <div>
              <Label htmlFor="lineCode">Código *</Label>
              <Input id="lineCode" placeholder="Ej: 1.1" {...registerLine("lineCode")} />
              {lineErrors.lineCode && <p className="text-xs text-red-500 mt-1">{lineErrors.lineCode.message}</p>}
            </div>
            <div>
              <Label htmlFor="lineDescription">Descripción *</Label>
              <Input id="lineDescription" {...registerLine("description")} placeholder="Descripción de la partida" />
              {lineErrors.description && (
                <p className="text-xs text-red-500 mt-1">{lineErrors.description.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="monthlyAmount">Monto mensual (opcional)</Label>
              <Input
                id="monthlyAmount"
                type="number"
                step="0.01"
                min="0"
                {...registerLine("monthlyAmount", {
                  setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
                })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeLineDialog}>Cancelar</Button>
              <Button type="submit" disabled={saveLineMutation.isPending}>
                {saveLineMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={adminOpen && !readOnly} onOpenChange={(v) => { if (!v) closeAdminDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar administración</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitAdmin((v) => saveAdminMutation.mutate(v))} className="space-y-4">
            <div>
              <Label htmlFor="adminName">Nombre *</Label>
              <Input id="adminName" {...registerAdmin("name")} placeholder="Ej: Administración Central" />
              {adminErrors.name && <p className="text-xs text-red-500 mt-1">{adminErrors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="managerName">Encargado de administración *</Label>
              <Input id="managerName" {...registerAdmin("managerName")} placeholder="Nombre completo" />
              {adminErrors.managerName && (
                <p className="text-xs text-red-500 mt-1">{adminErrors.managerName.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="managerEmail">Correo</Label>
                <Input id="managerEmail" type="email" {...registerAdmin("managerEmail")} />
                {adminErrors.managerEmail && (
                  <p className="text-xs text-red-500 mt-1">{adminErrors.managerEmail.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="managerPhone">Teléfono</Label>
                <Input id="managerPhone" {...registerAdmin("managerPhone")} />
              </div>
            </div>
            <div>
              <Label>Zona</Label>
              <Select
                value={watchAdmin("zoneId") ?? "__none__"}
                onValueChange={(v) => setAdminValue("zoneId", v === "__none__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar zona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin zona</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Líneas que se facturan a esta administración</Label>
              {billingLines.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Primero defina las líneas de facturación del contrato arriba.
                </p>
              ) : (
                <div className="mt-2 space-y-2 max-h-56 overflow-y-auto border rounded-md p-3">
                  {billingLines.map((line) => {
                    const selected = selectedLineIds.includes(line.id);
                    const link = selectedBillingLines.find((l) => l.billingLineId === line.id);
                    return (
                      <div key={line.id} className="flex items-start gap-2 text-sm">
                        <label className="flex items-start gap-2 flex-1 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            className="mt-1 rounded border-input shrink-0"
                            checked={selected}
                            onChange={() => toggleBillingLine(line.id)}
                          />
                          <span className="min-w-0">
                            <span className="font-mono text-xs">{line.lineCode}</span>
                            {" — "}
                            {line.description}
                            {line.monthlyAmount != null && !selected && (
                              <span className="text-muted-foreground"> ({formatCurrency(line.monthlyAmount)} ref.)</span>
                            )}
                          </span>
                        </label>
                        {selected && (
                          <div className="w-28 shrink-0">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder={line.monthlyAmount != null ? String(line.monthlyAmount) : "Monto"}
                              value={link?.monthlyAmount != null ? link.monthlyAmount : ""}
                              onChange={(e) => setBillingLineAmount(line.id, e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-3 rounded-lg border p-3">
              <div>
                <Label>Periodo de servicio facturado</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Contrato: {formatBillingPeriodRange(
                    contractBillingPeriod.billingPeriodFromDay,
                    contractBillingPeriod.billingPeriodToDay
                  )}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-input"
                  checked={useContractPeriod}
                  onChange={(e) => setUseContractPeriod(e.target.checked)}
                />
                Usar el mismo periodo del contrato
              </label>
              {!useContractPeriod && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdminValue("billingPeriodFromDay", 1, { shouldValidate: true });
                        setAdminValue("billingPeriodToDay", 31, { shouldValidate: true });
                      }}
                    >
                      Mes calendario (1 – 31)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdminValue("billingPeriodFromDay", 15, { shouldValidate: true });
                        setAdminValue("billingPeriodToDay", 14, { shouldValidate: true });
                      }}
                    >
                      Quincena (15 – 14)
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="billingPeriodFromDay">Día inicio</Label>
                      <Input
                        id="billingPeriodFromDay"
                        type="number"
                        min={1}
                        max={31}
                        {...registerAdmin("billingPeriodFromDay", {
                          setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                        })}
                      />
                      {adminErrors.billingPeriodFromDay && (
                        <p className="text-xs text-red-500 mt-1">
                          {adminErrors.billingPeriodFromDay.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="billingPeriodToDay">Día fin</Label>
                      <Input
                        id="billingPeriodToDay"
                        type="number"
                        min={1}
                        max={31}
                        {...registerAdmin("billingPeriodToDay", {
                          setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                        })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Si es menor que el inicio, el cierre cae en el mes siguiente.
                      </p>
                      {adminErrors.billingPeriodToDay && (
                        <p className="text-xs text-red-500 mt-1">
                          {adminErrors.billingPeriodToDay.message}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAdminDialog}>Cancelar</Button>
              <Button type="submit" disabled={saveAdminMutation.isPending}>
                {saveAdminMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
