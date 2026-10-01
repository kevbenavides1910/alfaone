"use client";

import { useMemo, useState } from "react";
import type { LegalChangeLogDto } from "@/modules/documentos-legales/business/dto";
import { formatDateTime } from "@/lib/utils/format";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { TableColumnFilterHead, type TableColumnFilterDef } from "@/components/ui/table-column-filters";

export function LegalBitacora({ rows }: { rows: LegalChangeLogDto[] }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const columns = useMemo((): TableColumnFilterDef<LegalChangeLogDto>[] => [
    { key: "createdAt", label: "Fecha", getValue: (row) => formatDateTime(row.createdAt) },
    { key: "document", label: "Documento", getValue: (row) => row.documentDescription ?? "" },
    { key: "field", label: "Campo", getValue: (row) => row.fieldLabel },
    { key: "previous", label: "Antes", getValue: (row) => row.previousValue ?? "" },
    { key: "next", label: "Después", getValue: (row) => row.newValue ?? "" },
    { key: "actor", label: "Usuario", getValue: (row) => row.changedByName ?? "" },
  ], []);
  const visible = useMemo(
    () => filterRowsByColumnFilters(rows, filters, columns),
    [rows, filters, columns],
  );

  return (
    <div className="max-h-[70vh] overflow-auto rounded-md border">
      <table data-table-id="documentos-legales-bitacora" className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <TableColumnFilterHead
            tableId="documentos-legales-bitacora"
            columns={columns}
            rows={rows}
            filters={filters}
            onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
            headerRowClassName="bg-card"
          />
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                No hay cambios en este mes.
              </td>
            </tr>
          ) : (
            visible.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="whitespace-nowrap px-2 py-1.5">{formatDateTime(row.createdAt)}</td>
                <td className="px-2 py-1.5">
                  <span className="whitespace-nowrap" title={row.documentDescription ?? ""}>
                    {row.documentDescription || "—"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5">{row.fieldLabel}</td>
                <td className="px-2 py-1.5">{row.previousValue || "—"}</td>
                <td className="px-2 py-1.5">{row.newValue || "—"}</td>
                <td className="whitespace-nowrap px-2 py-1.5">{row.changedByName || "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
