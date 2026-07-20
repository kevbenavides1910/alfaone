"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Save, GripVertical, Info, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { hasPermission } from "@/lib/permissions/check";
import {
  type ExpenseTypeConfig, type ExpenseOrigin, type CompanyCatalogRow, COLOR_OPTIONS,
} from "./admin-catalog-types";

export function OriginsTab({ readOnly }: { readOnly?: boolean }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: ExpenseOrigin[] }>({
    queryKey: ["expense-origins-admin"],
    queryFn: () => fetch("/api/admin/catalogs/origins").then(r => r.json()),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<ExpenseOrigin | null>(null);
  const [form, setForm] = useState({ name: "", isActive: true, sortOrder: 0 });

  function openAdd() {
    setForm({ name: "", isActive: true, sortOrder: (data?.data?.length ?? 0) + 1 });
    setShowAdd(true);
    setEditItem(null);
  }

  function openEdit(item: ExpenseOrigin) {
    setForm({ name: item.name, isActive: item.isActive, sortOrder: item.sortOrder });
    setEditItem(item);
    setShowAdd(true);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string; name: string; isActive: boolean; sortOrder: number }) => {
      if (payload.id) {
        return fetch(`/api/admin/catalogs/origins/${payload.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: payload.name, isActive: payload.isActive, sortOrder: payload.sortOrder }),
        }).then(r => r.json());
      }
      return fetch("/api/admin/catalogs/origins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: payload.name, isActive: payload.isActive, sortOrder: payload.sortOrder }),
      }).then(r => r.json());
    },
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error.message ?? "Error al guardar"); return; }
      toast.success(editItem ? "Origen actualizado" : "Origen creado");
      qc.invalidateQueries({ queryKey: ["expense-origins-admin"] });
      qc.invalidateQueries({ queryKey: ["expense-origins"] });
      setShowAdd(false);
      setEditItem(null);
    },
    onError: () => toast.error("Error al guardar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/catalogs/origins/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error.message ?? "Error al eliminar"); return; }
      if (res.data?.warning) {
        toast.error(res.data.warning);
      } else {
        toast.success("Origen eliminado");
      }
      qc.invalidateQueries({ queryKey: ["expense-origins-admin"] });
      qc.invalidateQueries({ queryKey: ["expense-origins"] });
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const origins = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">Configure los orígenes disponibles al registrar gastos (Orden de compra, Transferencia, etc.).</p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={origins.length === 0}
            onClick={() => {
              const exportRows = origins.map((o) => ({
                Nombre: o.name,
                Estado: o.isActive ? "Activo" : "Inactivo",
                Orden: o.sortOrder,
              }));
              exportRowsToExcel({
                filename: "origenes_de_gasto",
                sheetName: "Orígenes",
                rows: exportRows,
                columnWidths: [32, 12, 8],
              });
            }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar a Excel ({origins.length})
          </Button>
          {!readOnly && (
            <Button className="gap-2" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Agregar Origen
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-slate-400">Cargando...</div>
      ) : origins.length === 0 ? (
        <div className="p-8 text-center text-slate-400 border rounded-lg">
          No hay orígenes configurados. Agregue el primero con el botón de arriba.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Nombre</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 w-24">Estado</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 w-20">Orden</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {origins.map(o => (
                <tr key={o.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{o.name}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={o.isActive ? "success" : "secondary"}>
                      {o.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">{o.sortOrder}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {!readOnly && (
                        <>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(o)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="text-red-500 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`¿Eliminar el origen "${o.name}"?`)) deleteMutation.mutate(o.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      <Dialog open={showAdd && !readOnly} onOpenChange={v => { if (!v) { setShowAdd(false); setEditItem(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Origen" : "Agregar Origen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Nombre *</label>
              <Input
                placeholder="Ej: Orden de compra, Transferencia..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Orden</label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="text-center"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Estado</label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-slate-600">Activo</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!form.name.trim()) { toast.error("Ingrese un nombre"); return; }
                saveMutation.mutate({ id: editItem?.id, ...form });
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Companies Tab ─────────────────────────────────────────────────────────────
