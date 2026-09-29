"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TableColumnFilterHead, type TableColumnFilterDef } from "@/components/ui/table-column-filters";
import { toast } from "@/components/ui/toaster";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { cn } from "@/lib/utils/cn";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import {
  CALENDARIO_COLOR_KEYS,
  CALENDARIO_COLORS,
  calendarioColorClass,
  type CalendarioColor,
  type CalendarioEventTypeRow,
} from "@/modules/naf-operaciones/business/calendario-types";

const API = "/api/admin/catalogs/operational-event-types";
const QUERY_KEY = ["operational-event-types-admin"];

type FormState = { name: string; color: CalendarioColor; isActive: boolean; sortOrder: number };

function colorLabel(color: string): string {
  return (CALENDARIO_COLORS as Record<string, { label: string }>)[color]?.label ?? color;
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Error");
  return json?.data as T;
}

export function OperationalEventTypesTab({ readOnly }: { readOnly?: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => send<CalendarioEventTypeRow[]>(API, { method: "GET" }),
  });
  const rows = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<CalendarioEventTypeRow | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", color: "blue", isActive: true, sortOrder: 0 });
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QUERY_KEY });
    qc.invalidateQueries({ queryKey: ["calendario-operativo"] });
  };

  function openAdd() {
    setEditItem(null);
    setForm({ name: "", color: "blue", isActive: true, sortOrder: rows.length });
    setModalOpen(true);
  }
  function openEdit(row: CalendarioEventTypeRow) {
    setEditItem(row);
    setForm({
      name: row.name,
      color: (CALENDARIO_COLOR_KEYS as string[]).includes(row.color) ? (row.color as CalendarioColor) : "gray",
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    });
    setModalOpen(true);
  }

  const save = useMutation({
    mutationFn: () =>
      send(editItem ? `${API}/${editItem.id}` : API, {
        method: editItem ? "PATCH" : "POST",
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      }),
    onSuccess: () => {
      toast.success(editItem ? "Tipo actualizado" : "Tipo creado");
      invalidate();
      setModalOpen(false);
      setEditItem(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => send(`${API}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Tipo eliminado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columnDefs: TableColumnFilterDef<CalendarioEventTypeRow>[] = [
    { key: "name", label: "Nombre", headerClassName: "text-left px-4 py-3 font-semibold text-slate-600", getValue: (r) => r.name },
    { key: "color", label: "Color", headerClassName: "text-left px-4 py-3 font-semibold text-slate-600 w-40", getValue: (r) => colorLabel(r.color) },
    { key: "eventos", label: "Eventos", headerClassName: "text-center px-4 py-3 font-semibold text-slate-600 w-24", align: "center", getValue: (r) => String(r.eventsCount) },
    { key: "estado", label: "Estado", headerClassName: "text-center px-4 py-3 font-semibold text-slate-600 w-24", align: "center", getValue: (r) => (r.isActive ? "Activo" : "Inactivo") },
    { key: "orden", label: "Orden", headerClassName: "text-center px-4 py-3 font-semibold text-slate-600 w-20", align: "center", getValue: (r) => String(r.sortOrder) },
    { key: "actions", label: "", headerClassName: "px-4 py-3 w-24", filterable: false, getValue: () => "" },
  ];
  const displayedRows = filterRowsByColumnFilters(rows, columnFilters, columnDefs);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl space-y-1">
          <p className="text-sm text-slate-500">
            Tipos de evento del calendario operativo (cambio de uniformes, entregas, inspecciones…).
          </p>
          <p className="text-xs text-slate-400">
            El color identifica el evento en el calendario. Los tipos inactivos no se ofrecen para eventos nuevos;
            los que ya tienen eventos no se pueden eliminar, solo desactivar.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={displayedRows.length === 0}
            onClick={() =>
              exportRowsToExcel({
                filename: "tipos_evento_calendario",
                sheetName: "Tipos de evento",
                rows: displayedRows.map((r) => ({
                  Nombre: r.name,
                  Color: colorLabel(r.color),
                  Eventos: r.eventsCount,
                  Estado: r.isActive ? "Activo" : "Inactivo",
                  Orden: r.sortOrder,
                })),
                columnWidths: [32, 14, 10, 10, 8],
              })
            }
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar a Excel ({displayedRows.length})
          </Button>
          {!readOnly && (
            <Button className="gap-2" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Nuevo tipo
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-slate-400">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-slate-400">Sin tipos definidos.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table data-table-id="admin-operational-event-types" className="w-full text-sm">
            <thead>
              <TableColumnFilterHead
                tableId="admin-operational-event-types"
                defaultColumnWidths={{ name: 260, color: 160, eventos: 90, estado: 100, orden: 80, actions: 90 }}
                columns={columnDefs}
                rows={rows}
                filters={columnFilters}
                onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
              />
            </thead>
            <tbody className="divide-y">
              {displayedRows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded border px-2 py-0.5 text-xs", calendarioColorClass(r.color))}>
                      {colorLabel(r.color)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">{r.eventsCount}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={r.isActive ? "success" : "secondary"}>{r.isActive ? "Activo" : "Inactivo"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">{r.sortOrder}</td>
                  <td className="px-4 py-3">
                    {!readOnly && (
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:bg-red-50"
                          aria-label="Eliminar"
                          onClick={() => {
                            if (confirm(`¿Eliminar el tipo "${r.name}"?`)) remove.mutate(r.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={modalOpen && !readOnly}
        onOpenChange={(v) => {
          if (!v) {
            setModalOpen(false);
            setEditItem(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar tipo de evento" : "Nuevo tipo de evento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="oet-name">Nombre</Label>
              <Input
                id="oet-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej. Entrega de equipo de lluvia"
              />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {CALENDARIO_COLOR_KEYS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={cn(
                      "rounded border px-2.5 py-1 text-xs font-medium",
                      calendarioColorClass(c),
                      form.color === c && "ring-2 ring-slate-800 ring-offset-1",
                    )}
                  >
                    {CALENDARIO_COLORS[c].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-4">
              <div className="w-28 space-y-1">
                <Label htmlFor="oet-order">Orden</Label>
                <Input
                  id="oet-order"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: Math.max(0, Number(e.target.value) || 0) }))}
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Activo
              </label>
            </div>
            <div className="text-xs text-slate-500">
              Vista previa:{" "}
              <span className={cn("rounded border px-2 py-0.5", calendarioColorClass(form.color))}>
                {form.name.trim() || "Nombre del tipo"}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
