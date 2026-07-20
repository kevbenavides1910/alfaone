"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Pencil, Undo2, AlertTriangle, Package, MapPin, Search, ArrowRightCircle, X, FileSpreadsheet,
} from "lucide-react";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/utils/format";
import {
  type FieldType, type ExtraField, type AssetType, type AssetPosition, type AssetRow, type MovementRow,
  STATUS_LABEL, STATUS_VARIANT, MOVEMENT_LABEL, MOVEMENT_BADGE, INTAKE_REASON, ISSUE_REASON,
  describePosition, zoneName, matchesFilter, ColumnFilterInput, ensureAttrs, renderAttributes,
} from "@/app/(app)/inventory/inventory-types";

export function AssetsTable({
  assets, loading, tab, canManage, onEdit, onAssign, onIssue, onReturn, onDelete,
}: {
  assets: AssetRow[];
  loading: boolean;
  tab: "stock" | "assigned" | "pending";
  canManage: boolean;
  onEdit: (a: AssetRow) => void;
  onAssign: (a: AssetRow) => void;
  onIssue: (a: AssetRow) => void;
  onReturn: (a: AssetRow) => void;
  onDelete: (a: AssetRow) => void;
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => setFilters((prev) => ({ ...prev, [k]: v }));
  const hasActiveFilters = Object.values(filters).some((v) => v.trim());
  const showLocationCol = tab === "assigned" || tab === "pending";

  // Reset filters when switching tabs (some columns differ)
  useEffect(() => {
    setFilters({});
  }, [tab]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (!matchesFilter(`${a.type.name} ${a.type.code}`, filters.tipo ?? "")) return false;
      if (!matchesFilter(`${a.code} ${a.name ?? ""}`, filters.codigo ?? "")) return false;
      if (!matchesFilter(`${a.brand ?? ""} ${a.model ?? ""}`, filters.marca ?? "")) return false;
      if (!matchesFilter(renderAttributes(a), filters.attrs ?? "")) return false;
      if (showLocationCol) {
        if (!matchesFilter(describePosition(a.currentPosition), filters.ubic ?? "")) return false;
        if (!matchesFilter(zoneName(a.currentPosition) ?? "", filters.zona ?? "")) return false;
      }
      if (tab === "stock") {
        const oc = a.acquisitionExpense
          ? `${a.acquisitionExpense.referenceNumber ?? ""} ${a.acquisitionExpense.description}`
          : "";
        if (!matchesFilter(oc, filters.oc ?? "")) return false;
      }
      return true;
    });
  }, [assets, filters, tab, showLocationCol]);

  if (loading) return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  if (assets.length === 0) {
    const emptyText =
      tab === "stock"
        ? "No hay activos en stock."
        : tab === "assigned"
        ? "No hay activos asignados."
        : "No hay activos pendientes de devolución.";
    return <div className="p-10 text-center text-slate-400">{emptyText}</div>;
  }
  // Total columns (used for empty colSpan): base 4 + location + zone (if applicable) + oc (if stock) + actions
  const totalCols = 4 + (showLocationCol ? 2 : 0) + (tab === "stock" ? 1 : 0) + 1;

  function handleExport() {
    const rows = filtered.map((a) => {
      const base: Record<string, string | number> = {
        Tipo: a.type.name,
        "Código tipo": a.type.code,
        "Código / Serial": a.code,
        Nombre: a.name ?? "",
        Marca: a.brand ?? "",
        Modelo: a.model ?? "",
        Atributos: renderAttributes(a),
        Estado: STATUS_LABEL[a.status],
      };
      if (showLocationCol) {
        base["Contrato"] = a.currentPosition?.location.contract.licitacionNo ?? "";
        base["Cliente"] = a.currentPosition?.location.contract.client ?? "";
        base["Ubicación"] = a.currentPosition?.location.name ?? "";
        base["Puesto"] = a.currentPosition?.name ?? "";
        base["Zona"] = zoneName(a.currentPosition) ?? "";
      }
      if (tab === "stock") {
        base["OC / Gasto Ref."] = a.acquisitionExpense?.referenceNumber ?? "";
        base["OC / Gasto Descripción"] = a.acquisitionExpense?.description ?? "";
      }
      base["Notas"] = a.notes ?? "";
      base["Registrado"] = new Date(a.createdAt).toLocaleString("es-CR");
      base["Actualizado"] = new Date(a.updatedAt).toLocaleString("es-CR");
      return base;
    });
    const sheetByTab: Record<typeof tab, string> = {
      stock: "Stock disponible",
      assigned: "Asignados",
      pending: "Pendientes devolución",
    };
    const fileByTab: Record<typeof tab, string> = {
      stock: "inventario_stock",
      assigned: "inventario_asignados",
      pending: "inventario_pendientes_devolucion",
    };
    exportRowsToExcel({
      filename: fileByTab[tab],
      sheetName: sheetByTab[tab],
      rows,
      columnWidths: showLocationCol
        ? [16, 12, 18, 18, 14, 14, 28, 14, 22, 24, 22, 22, 16, 24, 18, 18]
        : [16, 12, 18, 18, 14, 14, 28, 14, 18, 32, 24, 18, 18],
    });
  }

  return (
    <div className="overflow-x-auto">
      {tab === "pending" && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
          Estos activos quedaron pendientes porque otro activo del mismo tipo fue asignado a su puesto.
          Devuélvalos al stock central cuando los reciba físicamente.
        </div>
      )}
      <div className="px-4 py-2 bg-muted/50/50 border-b flex items-center justify-end">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          onClick={handleExport}
          disabled={filtered.length === 0}
          title="Descargar lo mostrado a Excel"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Exportar a Excel ({filtered.length})
        </Button>
      </div>
      {hasActiveFilters && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 flex items-center justify-between">
          <span>
            Mostrando <strong>{filtered.length}</strong> de <strong>{assets.length}</strong> activo(s) tras filtros por columna.
          </span>
          <button
            type="button"
            onClick={() => setFilters({})}
            className="text-red-600 hover:underline font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Tipo</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Código</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Marca / modelo</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Atributos</th>
            {showLocationCol && (
              <>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Ubicación</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Zona</th>
              </>
            )}
            {tab === "stock" && (
              <th className="text-left px-4 py-3 font-semibold text-slate-600">OC / Gasto</th>
            )}
            <th className="px-4 py-3 w-64" />
          </tr>
          <tr className="bg-muted/50/60 border-b">
            <th className="px-3 py-1.5">
              <ColumnFilterInput value={filters.tipo ?? ""} onChange={(v) => setF("tipo", v)} placeholder="Tipo…" />
            </th>
            <th className="px-3 py-1.5">
              <ColumnFilterInput value={filters.codigo ?? ""} onChange={(v) => setF("codigo", v)} placeholder="Código / nombre…" />
            </th>
            <th className="px-3 py-1.5">
              <ColumnFilterInput value={filters.marca ?? ""} onChange={(v) => setF("marca", v)} placeholder="Marca / modelo…" />
            </th>
            <th className="px-3 py-1.5">
              <ColumnFilterInput value={filters.attrs ?? ""} onChange={(v) => setF("attrs", v)} placeholder="Atributos…" />
            </th>
            {showLocationCol && (
              <>
                <th className="px-3 py-1.5">
                  <ColumnFilterInput value={filters.ubic ?? ""} onChange={(v) => setF("ubic", v)} placeholder="Ubicación…" />
                </th>
                <th className="px-3 py-1.5">
                  <ColumnFilterInput value={filters.zona ?? ""} onChange={(v) => setF("zona", v)} placeholder="Zona…" />
                </th>
              </>
            )}
            {tab === "stock" && (
              <th className="px-3 py-1.5">
                <ColumnFilterInput value={filters.oc ?? ""} onChange={(v) => setF("oc", v)} placeholder="OC / Gasto…" />
              </th>
            )}
            <th />
          </tr>
        </thead>
        <tbody className="divide-y">
          {filtered.length === 0 && (
            <tr>
              <td colSpan={totalCols} className="p-8 text-center text-slate-400 text-xs">
                Ningún activo coincide con los filtros aplicados.
              </td>
            </tr>
          )}
          {filtered.map((a) => (
            <tr key={a.id} className="hover:bg-muted/50">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-800">{a.type.name}</div>
                <div className="text-xs text-slate-400">{a.type.code}</div>
              </td>
              <td className="px-4 py-3">
                <code className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{a.code}</code>
                {a.name && <div className="text-xs text-slate-500 mt-0.5">{a.name}</div>}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {[a.brand, a.model].filter(Boolean).join(" / ") || <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500 max-w-[260px]">
                {renderAttributes(a) || <span className="text-slate-300">—</span>}
              </td>
              {showLocationCol && (
                <>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {describePosition(a.currentPosition)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {zoneName(a.currentPosition) ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-medium">
                        {zoneName(a.currentPosition)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </>
              )}
              {tab === "stock" && (
                <td className="px-4 py-3 text-xs text-slate-600">
                  {a.acquisitionExpense ? (
                    <span title={a.acquisitionExpense.description}>
                      {a.acquisitionExpense.referenceNumber ?? a.acquisitionExpense.description}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              )}
              <td className="px-4 py-3">
                {canManage && (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(a)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {tab === "assigned" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1"
                        onClick={() => onReturn(a)}
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Devolver
                      </Button>
                    )}
                    {tab === "pending" && (
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1 bg-amber-600 hover:bg-amber-700"
                        onClick={() => onReturn(a)}
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Devolver al stock
                      </Button>
                    )}
                    {tab === "stock" && (
                      <>
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => onAssign(a)}
                          title="Asignar a un puesto"
                        >
                          <ArrowRightCircle className="h-3.5 w-3.5" /> Asignar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                          onClick={() => onIssue(a)}
                          title="Dar de baja"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" /> Baja
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:bg-red-50"
                          onClick={() => onDelete(a)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Movements Table

