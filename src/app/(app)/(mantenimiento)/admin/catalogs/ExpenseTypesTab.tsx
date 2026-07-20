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

// ── Expense Types Tab ─────────────────────────────────────────────────────────
export function ExpenseTypesTab({ readOnly }: { readOnly?: boolean }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: ExpenseTypeConfig[] }>({
    queryKey: ["expense-type-configs"],
    queryFn: () => fetch("/api/admin/catalogs/expense-types").then(r => r.json()),
  });

  const [configs, setConfigs] = useState<ExpenseTypeConfig[] | null>(null);
  const [showTypeInfo, setShowTypeInfo] = useState(false);
  const rows = configs ?? data?.data ?? [];

  useEffect(() => {
    if (data?.data) {
      setConfigs(data.data.map((r) => ({ ...r })));
    }
  }, [data]);

  const deleteMutation = useMutation({
    mutationFn: (type: string) =>
      fetch(`/api/admin/catalogs/expense-types/${encodeURIComponent(type)}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error?.message ?? "Error al restablecer");
        return;
      }
      toast.success(res.data?.message ?? "Tipo restablecido a valores por defecto");
      qc.invalidateQueries({ queryKey: ["expense-type-configs"] });
    },
    onError: () => toast.error("Error al restablecer"),
  });

  const saveMutation = useMutation({
    mutationFn: (items: ExpenseTypeConfig[]) =>
      fetch("/api/admin/catalogs/expense-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items.map(({ id: _id, ...rest }) => rest as unknown)),
      }).then(r => r.json()),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error.message ?? "Error al guardar"); return; }
      toast.success("Tipos de gasto guardados");
      qc.invalidateQueries({ queryKey: ["expense-type-configs"] });
      setConfigs(null);
    },
    onError: () => toast.error("Error al guardar"),
  });

  function updateRow(type: string, field: keyof ExpenseTypeConfig, value: unknown) {
    setConfigs(prev => (prev ?? data?.data ?? []).map(r => r.type === type ? { ...r, [field]: value } : r));
  }

  if (isLoading) return <div className="p-8 text-center text-slate-400">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">
            Configure las etiquetas y colores de los tipos de gasto del sistema.
          </p>
          <p className="text-xs text-slate-400 flex items-start gap-1.5 max-w-xl">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Los tipos de gasto son <strong className="font-medium text-slate-600">9 categorías fijas</strong> (definidas en la base de datos).
            No se pueden crear categorías nuevas desde aquí; use <strong className="font-medium text-slate-600">Otros</strong> para gastos que no encajen.
            Desmarque <strong className="font-medium text-slate-600">Activo</strong> para ocultar un tipo en los formularios.
            Use <strong className="font-medium text-slate-600">Restablecer</strong> para volver a etiqueta y color por defecto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={rows.length === 0}
            onClick={() => {
              const exportRows = rows.map((r) => ({
                Tipo: r.type,
                Etiqueta: r.label,
                Color: r.color,
                Activo: r.isActive ? "Sí" : "No",
                Orden: r.sortOrder,
              }));
              exportRowsToExcel({
                filename: "tipos_de_gasto",
                sheetName: "Tipos de gasto",
                rows: exportRows,
                columnWidths: [16, 22, 32, 8, 8],
              });
            }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar a Excel ({rows.length})
          </Button>
          {!readOnly && (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setShowTypeInfo(true)}>
                <Plus className="h-4 w-4" />
                ¿Agregar tipo?
              </Button>
              <Button
                className="gap-2"
                onClick={() => saveMutation.mutate(rows)}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={showTypeInfo} onOpenChange={setShowTypeInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar tipos de gasto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-600 py-1">
            <p>
              El sistema solo admite las ocho categorías listadas en la tabla (Apertura, Uniformes, Auditoría, etc.).
              No es posible añadir una novena categoría desde esta pantalla.
            </p>
            <p>
              Para gastos varios use el tipo <strong>Otros</strong>. Para dejar de usar una categoría, desactívela con la casilla <strong>Activo</strong>.
            </p>
            <p className="text-xs text-slate-500">
              Si en el futuro necesita más categorías, eso requiere cambios en la aplicación y en la base de datos (enum de tipos).
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTypeInfo(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-8">#</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-28">Tipo</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Etiqueta</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-52">Color</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-20">Vista previa</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-600 w-20">Activo</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-600 w-20">Orden</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600 w-24">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.type} className="hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3 text-slate-400">
                  <GripVertical className="h-4 w-4" />
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{row.type}</code>
                </td>
                <td className="px-4 py-3">
                  <Input
                    value={row.label}
                    onChange={e => updateRow(row.type, "label", e.target.value)}
                    className="h-8 text-sm"
                    disabled={readOnly}
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    value={row.color}
                    onChange={e => updateRow(row.type, "color", e.target.value)}
                    className="w-full h-8 text-xs border rounded-md px-2 bg-card"
                    disabled={readOnly}
                  >
                    {COLOR_OPTIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                    {/* Allow keeping custom values not in predefined list */}
                    {!COLOR_OPTIONS.find(c => c.value === row.color) && (
                      <option value={row.color}>{row.color}</option>
                    )}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${row.color}`}>
                    {row.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={row.isActive}
                    onChange={e => updateRow(row.type, "isActive", e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-red-600"
                    disabled={readOnly}
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="number"
                    value={row.sortOrder}
                    onChange={e => updateRow(row.type, "sortOrder", parseInt(e.target.value) || 0)}
                    className="h-8 text-sm w-16 text-center"
                    disabled={readOnly}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      title="Quitar personalización y volver a etiqueta y color por defecto"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            `¿Restablecer "${row.type}" a la etiqueta y color por defecto? Se eliminará la personalización guardada en base de datos.`
                          )
                        ) {
                          deleteMutation.mutate(row.type);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Origins Tab ───────────────────────────────────────────────────────────────
