"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, TrendingUp, TrendingDown, Minus, FileSpreadsheet, Pencil, Trash2, Loader2, Sparkles } from "lucide-react";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/utils/format";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  specialServiceSchema,
  type SpecialServiceInput,
} from "@/modules/presupuestos/validations/contract.schema";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";

interface BillingEntry {
  id: string;
  periodMonth: string;
  monthlyBilling: number;
  notes?: string;
}

interface SpecialService {
  id: string;
  periodMonth: string;
  description: string;
  amount: number;
  startDate: string;
  endDate: string;
  notes?: string | null;
}

interface Props {
  contractId: string;
  monthlyBilling: number;
  contractBaseBilling: number;
  readOnly?: boolean;
}

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultSpecialServiceForm(): SpecialServiceInput {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = toDateInputValue(now.toISOString());
  return {
    periodMonth: ym,
    description: "",
    amount: 0,
    startDate: today,
    endDate: today,
    notes: "",
  };
}

export function BillingHistoryTab({
  contractId,
  monthlyBilling,
  contractBaseBilling,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [editingService, setEditingService] = useState<SpecialService | null>(null);
  const now = new Date();
  const [form, setForm] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    monthlyBilling,
    notes: "",
  });

  const { data, isLoading } = useQuery<{ data: BillingEntry[] }>({
    queryKey: ["billing-history", contractId],
    queryFn: () => fetch(`/api/contracts/${contractId}/billing-history`).then((r) => r.json()),
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery<{ data: SpecialService[] }>({
    queryKey: ["special-services", contractId],
    queryFn: () => fetch(`/api/contracts/${contractId}/special-services`).then((r) => r.json()),
  });

  const {
    register: registerService,
    handleSubmit: handleSubmitService,
    reset: resetService,
    formState: { errors: serviceErrors },
  } = useForm<SpecialServiceInput>({
    resolver: zodResolver(specialServiceSchema),
    defaultValues: defaultSpecialServiceForm(),
  });

  const saveMutation = useMutation({
    mutationFn: (body: { periodMonth: string; monthlyBilling: number; notes?: string }) =>
      fetch(`/api/contracts/${contractId}/billing-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["billing-history", contractId] });
      qc.invalidateQueries({ queryKey: ["contract", contractId] });
      qc.invalidateQueries({ queryKey: ["profitability", contractId] });
      toast.success("Registro de venta actualizado");
      setShowForm(false);
    },
    onError: () => toast.error("Error al guardar"),
  });

  const saveServiceMutation = useMutation({
    mutationFn: async (payload: SpecialServiceInput) => {
      const url = editingService
        ? `/api/contracts/${contractId}/special-services/${editingService.id}`
        : `/api/contracts/${contractId}/special-services`;
      const r = await fetch(url, {
        method: editingService ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["special-services", contractId] });
      qc.invalidateQueries({ queryKey: ["profitability", contractId] });
      qc.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success(editingService ? "Servicio especial actualizado" : "Servicio especial registrado");
      closeServiceDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/contracts/${contractId}/special-services/${id}`, { method: "DELETE" });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al eliminar");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["special-services", contractId] });
      qc.invalidateQueries({ queryKey: ["profitability", contractId] });
      qc.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Servicio especial eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    const periodMonth = `${form.year}-${String(form.month).padStart(2, "0")}`;
    saveMutation.mutate({ periodMonth, monthlyBilling: form.monthlyBilling, notes: form.notes || undefined });
  }

  function openCreateService() {
    setEditingService(null);
    resetService(defaultSpecialServiceForm());
    setServiceOpen(true);
  }

  function openEditService(row: SpecialService) {
    setEditingService(row);
    resetService({
      periodMonth: row.periodMonth.slice(0, 7),
      description: row.description,
      amount: row.amount,
      startDate: toDateInputValue(row.startDate),
      endDate: toDateInputValue(row.endDate),
      notes: row.notes ?? "",
    });
    setServiceOpen(true);
  }

  function closeServiceDialog() {
    setServiceOpen(false);
    setEditingService(null);
    resetService(defaultSpecialServiceForm());
  }

  const entries = data?.data ?? [];
  const services = servicesData?.data ?? [];
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const onColumnFilterChange = (k: string, v: string) => setColumnFilters((p) => ({ ...p, [k]: v }));

  const columnDefs = useMemo((): TableColumnFilterDef<BillingEntry>[] => {
    return [
      { key: "period", label: "Período", getValue: (e) => e.periodMonth },
      { key: "facturacion", label: "Facturación", getValue: (e) => String(e.monthlyBilling) },
      { key: "notes", label: "Notas", getValue: (e) => e.notes ?? "" },
    ];
  }, []);

  const filteredEntries = useMemo(
    () =>
      filterRowsByColumnFilters(
        entries,
        columnFilters,
        columnDefs.map((c) => ({ key: c.key, getValue: c.getValue, mode: c.mode, filterable: c.filterable }))
      ),
    [entries, columnDefs, columnFilters]
  );
  const columnFilterKeys = useMemo(() => columnDefs.map((c) => c.key), [columnDefs]);
  const yearOpts = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);
  const servicesTotal = services.reduce((s, row) => s + row.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header — registro mensual */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-slate-800">Registro de venta</h3>
          <p className="text-sm text-slate-500">
            Facturación mensual vigente: <span className="font-semibold">{formatCurrency(monthlyBilling)}/mes</span>
            {" · "}Base contrato: <span className="font-semibold">{formatCurrency(contractBaseBilling)}/mes</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={entries.length === 0}
            onClick={() => {
              const exportRows = entries.map((e) => {
                const diff = e.monthlyBilling - contractBaseBilling;
                const pct = contractBaseBilling > 0 ? (diff / contractBaseBilling) * 100 : 0;
                return {
                  Período: formatMonthYear(e.periodMonth),
                  Facturación: e.monthlyBilling,
                  "vs. Base ₡": diff,
                  "vs. Base %": diff !== 0 ? `${diff > 0 ? "+" : ""}${pct.toFixed(2)}%` : "0%",
                  Notas: e.notes ?? "",
                };
              });
              exportRowsToExcel({
                filename: `registro_venta_contrato_${contractId}`,
                sheetName: "Registro de venta",
                rows: exportRows,
                columnWidths: [16, 18, 16, 12, 40],
              });
            }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar ventas ({entries.length})
          </Button>
          {!readOnly && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setShowForm((prev) => {
                  if (!prev) setForm((f) => ({ ...f, monthlyBilling }));
                  return !prev;
                });
              }}
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Cancelar" : "Actualizar venta mensual"}
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-slate-800">Registrar facturación para un mes específico</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Año</label>
                <select
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })}
                >
                  {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">Mes</label>
                <select
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: parseInt(e.target.value) })}
                >
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">Facturación mensual (₡)</label>
                <Input
                  type="number"
                  value={form.monthlyBilling}
                  onChange={(e) => setForm({ ...form, monthlyBilling: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Notas (opcional)</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Ej: Ajuste por prórroga, incremento salarial..."
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={submit} disabled={saveMutation.isPending} size="sm">
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Ventas mensuales registradas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Cargando...</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No hay registros de venta guardados.<br />
              <span className="text-xs">Se usa la facturación base del contrato en todos los meses.</span>
            </div>
          ) : (
            <>
              {hasActiveColumnFilters(columnFilters) && (
                <div className="flex justify-end px-3 py-1.5 border-b bg-muted/50">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setColumnFilters(clearColumnFilters(columnFilterKeys))}>
                    Limpiar filtros
                  </Button>
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <TableColumnFilterHead
                    columns={columnDefs}
                    rows={entries}
                    filters={columnFilters}
                    onFilterChange={onColumnFilterChange}
                    filterRowClassName="bg-muted/50"
                  />
                </thead>
                <tbody className="divide-y">
                  {filteredEntries.map((e) => {
                    const diff = e.monthlyBilling - contractBaseBilling;
                    const pct = contractBaseBilling > 0 ? (diff / contractBaseBilling) * 100 : 0;
                    return (
                      <tr key={e.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">{formatMonthYear(e.periodMonth)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(e.monthlyBilling)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-slate-400"}`}>
                            {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {diff !== 0 ? `${diff > 0 ? "+" : ""}${pct.toFixed(1)}%` : "Igual"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{e.notes ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
          {entries.length > 0 && (
            <div />
          )}
        </CardContent>
      </Card>

      {/* Servicios especiales */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Servicios especiales
          </h3>
          <p className="text-sm text-slate-500">
            Montos adicionales fuera de la venta mensual. Se suman al total facturado desde el inicio
            {servicesTotal > 0 && (
              <> · Acumulado: <span className="font-semibold text-amber-700">{formatCurrency(servicesTotal)}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={services.length === 0}
            onClick={() => {
              exportRowsToExcel({
                filename: `servicios_especiales_contrato_${contractId}`,
                sheetName: "Servicios especiales",
                rows: services.map((s) => ({
                  Mes: formatMonthYear(s.periodMonth),
                  Servicio: s.description,
                  Monto: s.amount,
                  "Fecha inicio": formatDate(s.startDate),
                  "Fecha fin": formatDate(s.endDate),
                  Notas: s.notes ?? "",
                })),
                columnWidths: [14, 36, 16, 14, 14, 30],
              });
            }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar ({services.length})
          </Button>
          {!readOnly && (
            <Button size="sm" className="gap-1.5" onClick={openCreateService}>
              <Plus className="h-4 w-4" />
              Agregar servicio
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {servicesLoading ? (
            <div className="p-8 text-center text-slate-400">Cargando servicios especiales...</div>
          ) : services.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No hay servicios especiales registrados.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Mes</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Servicio</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Rango de fechas</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Monto</th>
                  {!readOnly && <th className="w-20 px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{formatMonthYear(s.periodMonth)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{s.description}</p>
                      {s.notes && <p className="text-xs text-slate-500 mt-0.5">{s.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(s.startDate)} — {formatDate(s.endDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-700">{formatCurrency(s.amount)}</td>
                    {!readOnly && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditService(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500"
                            disabled={deleteServiceMutation.isPending}
                            onClick={() => {
                              if (confirm("¿Eliminar este servicio especial?")) deleteServiceMutation.mutate(s.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={serviceOpen} onOpenChange={(v) => !v && closeServiceDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingService ? "Editar servicio especial" : "Registrar servicio especial"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitService((values) => saveServiceMutation.mutate(values))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="periodMonth">Mes *</Label>
                <Input id="periodMonth" type="month" {...registerService("periodMonth")} />
                {serviceErrors.periodMonth && (
                  <p className="text-xs text-red-500 mt-1">{serviceErrors.periodMonth.message}</p>
                )}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="amount">Monto (₡) *</Label>
                <Input id="amount" type="number" step="0.01" {...registerService("amount", { valueAsNumber: true })} />
                {serviceErrors.amount && (
                  <p className="text-xs text-red-500 mt-1">{serviceErrors.amount.message}</p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="description">Detalle del servicio *</Label>
              <Input id="description" placeholder="Ej: Cobertura extra fin de semana, evento especial..." {...registerService("description")} />
              {serviceErrors.description && (
                <p className="text-xs text-red-500 mt-1">{serviceErrors.description.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startDate">Fecha inicio *</Label>
                <Input id="startDate" type="date" {...registerService("startDate")} />
                {serviceErrors.startDate && (
                  <p className="text-xs text-red-500 mt-1">{serviceErrors.startDate.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="endDate">Fecha fin *</Label>
                <Input id="endDate" type="date" {...registerService("endDate")} />
                {serviceErrors.endDate && (
                  <p className="text-xs text-red-500 mt-1">{serviceErrors.endDate.message}</p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="serviceNotes">Notas (opcional)</Label>
              <Input id="serviceNotes" {...registerService("notes")} placeholder="Observaciones adicionales..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeServiceDialog}>Cancelar</Button>
              <Button type="submit" disabled={saveServiceMutation.isPending} className="gap-1.5">
                {saveServiceMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingService ? "Guardar cambios" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
