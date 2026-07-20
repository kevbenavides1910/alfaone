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

export function CompaniesTab({ readOnly }: { readOnly?: boolean }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: CompanyCatalogRow[] }>({
    queryKey: ["admin-companies-catalog"],
    queryFn: () => fetch("/api/admin/catalogs/companies").then((r) => r.json()),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<CompanyCatalogRow | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    sapCode: "",
    isActive: true,
    sortOrder: 0,
  });

  function openAdd() {
    const rows = data?.data ?? [];
    setForm({
      code: "",
      name: "",
      sapCode: "",
      isActive: true,
      sortOrder: rows.length ? Math.max(...rows.map((r) => r.sortOrder)) + 1 : 1,
    });
    setShowAdd(true);
    setEditItem(null);
  }

  function openEdit(item: CompanyCatalogRow) {
    setForm({
      code: item.code,
      name: item.name,
      sapCode: item.sapCode ?? "",
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    });
    setEditItem(item);
    setShowAdd(true);
  }

  type SaveCompanyPayload = {
    name: string;
    sapCode: string;
    isActive: boolean;
    sortOrder: number;
    /** Alta */
    newCode?: string;
    /** Edición: código existente */
    existingCode?: string;
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: SaveCompanyPayload) => {
      const sapPayload = payload.sapCode.trim() ? payload.sapCode.trim() : null;
      const isEdit = Boolean(payload.existingCode);
      const url = isEdit
        ? `/api/admin/catalogs/companies/${encodeURIComponent(payload.existingCode!)}`
        : "/api/admin/catalogs/companies";
      const init: RequestInit = isEdit
        ? {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: payload.name,
              sapCode: sapPayload,
              isActive: payload.isActive,
              sortOrder: payload.sortOrder,
            }),
          }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: payload.newCode ?? "",
              name: payload.name,
              sapCode: sapPayload,
              isActive: payload.isActive,
              sortOrder: payload.sortOrder,
            }),
          };
      const r = await fetch(url, init);
      const json = (await r.json().catch(() => ({}))) as { data?: unknown; error?: { message?: string } };
      if (!r.ok || json.error) {
        throw new Error(json.error?.message ?? `Error ${r.status}`);
      }
      return { json, isEdit };
    },
    onSuccess: ({ isEdit }) => {
      toast.success(isEdit ? "Empresa actualizada" : "Empresa creada");
      qc.invalidateQueries({ queryKey: ["admin-companies-catalog"] });
      qc.invalidateQueries({ queryKey: ["companies-catalog"] });
      setShowAdd(false);
      setEditItem(null);
    },
    onError: (e: Error) => toast.error(e.message || "Error al guardar"),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">
            Administre el catálogo de empresas del grupo. El código es estable (mayúsculas); se usa en contratos y reportes.
            El <strong className="font-medium text-slate-600">código planilla</strong> vincula cada empresa con el número del CSV de RRHH (01 = Alfa, 04 = Bena, etc.).
          </p>
          <p className="text-xs text-slate-400 max-w-2xl">
            Las empresas <strong className="font-medium text-slate-600">inactivas</strong> no aparecen al crear contratos, gastos o usuarios,
            pero los registros existentes siguen mostrando el nombre correcto.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={rows.length === 0}
            onClick={() => {
              const exportRows = rows.map((r) => ({
                Código: r.code,
                Nombre: r.name,
                "Cód. planilla": r.sapCode ?? "",
                Estado: r.isActive ? "Activa" : "Inactiva",
                Orden: r.sortOrder,
              }));
              exportRowsToExcel({
                filename: "empresas",
                sheetName: "Empresas",
                rows: exportRows,
                columnWidths: [16, 32, 12, 8],
              });
            }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar a Excel ({rows.length})
          </Button>
          {!readOnly && (
            <Button className="gap-2" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Nueva empresa
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-slate-400">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-slate-400 border rounded-lg">No hay empresas en el catálogo.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-36">Código</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Nombre</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 w-28">Planilla</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 w-28">Estado</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 w-20">Orden</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.code} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <code className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{row.code}</code>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                  <td className="px-4 py-3 text-center">
                    {row.sapCode ? (
                      <code className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{row.sapCode}</code>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={row.isActive ? "success" : "secondary"}>
                      {row.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">{row.sortOrder}</td>
                  <td className="px-4 py-3">
                    {!readOnly && (
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                          <Pencil className="h-3.5 w-3.5" />
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

      <Dialog open={showAdd && !readOnly} onOpenChange={(v) => { if (!v) { setShowAdd(false); setEditItem(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar empresa" : "Nueva empresa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editItem && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Código *</label>
                <Input
                  placeholder="Ej: NUEVA_EMPRESA"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))}
                />
                <p className="text-xs text-slate-400">Solo mayúsculas, números y guión bajo. No se puede cambiar después.</p>
              </div>
            )}
            {editItem && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Código</label>
                <code className="block text-sm bg-slate-100 px-2 py-1.5 rounded">{editItem.code}</code>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Nombre para mostrar *</label>
              <Input
                placeholder="Nombre comercial o razón social corta"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Código planilla RRHH</label>
              <Input
                placeholder="Ej: 01 (Alfa), 04 (Bena), 30 (ACE)"
                value={form.sapCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sapCode: e.target.value.replace(/\D/g, "").slice(0, 3) }))
                }
                className="font-mono"
              />
              <p className="text-xs text-slate-400">
                Número de la columna Compañía del CSV de empleados. Debe coincidir con el catálogo para vincular automáticamente.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Orden</label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="text-center"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Estado</label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-slate-600">Activa</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!form.name.trim()) {
                  toast.error("Ingrese el nombre");
                  return;
                }
                if (!editItem && !form.code.trim()) {
                  toast.error("Ingrese el código");
                  return;
                }
                const newCode = form.code.trim().toUpperCase();
                if (!editItem && rows.some((r) => r.code === newCode)) {
                  toast.error(
                    "Ya existe una empresa con ese código. Use «Editar» en la fila correspondiente o elija otro código (p. ej. ALFA ya está en el catálogo inicial)."
                  );
                  return;
                }
                saveMutation.mutate(
                  editItem
                    ? {
                        existingCode: editItem.code,
                        name: form.name.trim(),
                        sapCode: form.sapCode,
                        isActive: form.isActive,
                        sortOrder: form.sortOrder,
                      }
                    : {
                        newCode,
                        name: form.name.trim(),
                        sapCode: form.sapCode,
                        isActive: form.isActive,
                        sortOrder: form.sortOrder,
                      }
                );
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

// ── Main page ─────────────────────────────────────────────────────────────────
