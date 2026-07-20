"use client";

import { useState, useMemo } from "react";
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

export function MovementsTable({ movements, loading }: { movements: MovementRow[]; loading: boolean }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => setFilters((prev) => ({ ...prev, [k]: v }));
  const hasActiveFilters = Object.values(filters).some((v) => v.trim());

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (!matchesFilter(formatDate(m.createdAt), filters.fecha ?? "")) return false;
      if (!matchesFilter(MOVEMENT_LABEL[m.type], filters.accion ?? "")) return false;
      if (!matchesFilter(`${m.asset.type.name} ${m.asset.code} ${m.asset.name ?? ""}`, filters.activo ?? "")) return false;
      const desdeText = `${describePosition(m.fromPosition)} ${zoneName(m.fromPosition) ?? ""}`;
      const haciaText = `${describePosition(m.toPosition)} ${zoneName(m.toPosition) ?? ""}`;
      if (!matchesFilter(desdeText, filters.desde ?? "")) return false;
      if (!matchesFilter(haciaText, filters.hacia ?? "")) return false;
      const motivoText = [
        m.intakeReason ? INTAKE_REASON[m.intakeReason] : "",
        m.issueReason ? ISSUE_REASON[m.issueReason] : "",
        m.expense ? `${m.expense.referenceNumber ?? ""} ${m.expense.description}` : "",
      ]
        .join(" ")
        .trim();
      if (!matchesFilter(motivoText, filters.motivo ?? "")) return false;
      if (!matchesFilter(m.notes ?? "", filters.notas ?? "")) return false;
      return true;
    });
  }, [movements, filters]);

  if (loading) return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  if (movements.length === 0) {
    return <div className="p-10 text-center text-slate-400">Sin movimientos registrados.</div>;
  }

  function handleExport() {
    const rows = filtered.map((m) => ({
      Fecha: new Date(m.createdAt).toLocaleString("es-CR"),
      Acción: MOVEMENT_LABEL[m.type],
      "Tipo activo": m.asset.type.name,
      "Código activo": m.asset.code,
      "Nombre activo": m.asset.name ?? "",
      "Desde - Contrato": m.fromPosition?.location.contract.licitacionNo ?? "",
      "Desde - Ubicación": m.fromPosition?.location.name ?? "",
      "Desde - Puesto": m.fromPosition?.name ?? "",
      "Desde - Zona": zoneName(m.fromPosition) ?? "",
      "Hacia - Contrato": m.toPosition?.location.contract.licitacionNo ?? "",
      "Hacia - Ubicación": m.toPosition?.location.name ?? "",
      "Hacia - Puesto": m.toPosition?.name ?? "",
      "Hacia - Zona": zoneName(m.toPosition) ?? "",
      "Motivo ingreso": m.intakeReason ? INTAKE_REASON[m.intakeReason] : "",
      "Motivo salida": m.issueReason ? ISSUE_REASON[m.issueReason] : "",
      "OC / Gasto Ref.": m.expense?.referenceNumber ?? "",
      "OC / Gasto Descripción": m.expense?.description ?? "",
      Notas: m.notes ?? "",
    }));
    exportRowsToExcel({
      filename: "inventario_movimientos",
      sheetName: "Movimientos",
      rows,
      columnWidths: [18, 14, 16, 18, 22, 22, 22, 22, 16, 22, 22, 22, 16, 16, 16, 18, 28, 28],
    });
  }

  return (
    <div className="overflow-x-auto">
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
            Mostrando <strong>{filtered.length}</strong> de <strong>{movements.length}</strong> movimiento(s) tras filtros por columna.
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
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Fecha</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Acción</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Activo</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Desde</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Hacia</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Motivo / OC</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Notas</th>
          </tr>
          <tr className="bg-muted/50/60 border-b">
            <th className="px-3 py-1.5">
              <ColumnFilterInput value={filters.fecha ?? ""} onChange={(v) => setF("fecha", v)} placeholder="Fecha…" />
            </th>
            <th className="px-3 py-1.5">
              <ColumnFilterInput value={filters.accion ?? ""} onChange={(v) => setF("accion", v)} placeholder="Acción…" />
            </th>
            <th className="px-3 py-1.5">
              <ColumnFilterInput value={filters.activo ?? ""} onChange={(v) => setF("activo", v)} placeholder="Activo…" />
            </th>
            <th className="px-3 py-1.5">
              <ColumnFilterInput value={filters.desde ?? ""} onChange={(v) => setF("desde", v)} placeholder="Desde…" />
            </th>
            <th className="px-3 py-1.5">
              <ColumnFilterInput value={filters.hacia ?? ""} onChange={(v) => setF("hacia", v)} placeholder="Hacia…" />
            </th>
            <th className="px-3 py-1.5">
              <ColumnFilterInput value={filters.motivo ?? ""} onChange={(v) => setF("motivo", v)} placeholder="Motivo / OC…" />
            </th>
            <th className="px-3 py-1.5">
              <ColumnFilterInput value={filters.notas ?? ""} onChange={(v) => setF("notas", v)} placeholder="Notas…" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                Ningún movimiento coincide con los filtros aplicados.
              </td>
            </tr>
          )}
          {filtered.map((m) => (
            <tr key={m.id} className="hover:bg-muted/50">
              <td className="px-4 py-3 text-xs text-slate-600">{formatDate(m.createdAt)}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${MOVEMENT_BADGE[m.type]}`}>
                  {MOVEMENT_LABEL[m.type]}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-800">{m.asset.type.name}</div>
                <code className="text-xs bg-slate-100 text-slate-600 px-1 rounded">{m.asset.code}</code>
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {describePosition(m.fromPosition)}
                {zoneName(m.fromPosition) && (
                  <div className="mt-0.5">
                    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-medium">
                      Zona: {zoneName(m.fromPosition)}
                    </span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {describePosition(m.toPosition)}
                {zoneName(m.toPosition) && (
                  <div className="mt-0.5">
                    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-medium">
                      Zona: {zoneName(m.toPosition)}
                    </span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {m.intakeReason && INTAKE_REASON[m.intakeReason]}
                {m.issueReason && ISSUE_REASON[m.issueReason]}
                {m.expense && (
                  <span className="block text-slate-500">
                    {m.expense.referenceNumber ?? m.expense.description}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{m.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Intake Dialog (ingreso a stock)

