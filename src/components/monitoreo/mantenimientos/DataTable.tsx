"use client";

import React, { useMemo, useState } from "react";
import {
  TableColumnFilterHead,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";

export function DataTable({ headers, rows }: { headers: string[]; rows: (string | number | React.ReactNode)[][] }) {
  const columnDefs = useMemo((): TableColumnFilterDef<(string | number | React.ReactNode)[]>[] => {
    return headers.map((h, idx) => {
      const sample = rows.find((r) => r[idx] !== undefined)?.[idx];
      const isPrimitive = typeof sample === "string" || typeof sample === "number" || typeof sample === "boolean";
      return {
        key: `col_${idx}`,
        label: h,
        filterable: isPrimitive,
        getValue: (row: (string | number | React.ReactNode)[]) => {
          const v = row[idx];
          return isPrimitive ? String(v as string | number | boolean) : "";
        },
      };
    });
  }, [headers, rows]);

  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const onColumnFilterChange = (k: string, v: string) => setColumnFilters((p) => ({ ...p, [k]: v }));
  const columnFilterKeys = columnDefs.filter((c) => c.filterable !== false).map((c) => c.key);

  const filtered = useMemo(
    () =>
      filterRowsByColumnFilters(
        rows,
        columnFilters,
        columnDefs.map((c) => ({ key: c.key, getValue: c.getValue, mode: c.mode, filterable: c.filterable }))
      ),
    [rows, columnFilters, columnDefs]
  );

  if (rows.length === 0) return <p className="p-8 text-center text-slate-400">Sin registros.</p>;

  return (
    <>
      {Object.values(columnFilters).some((v) => v.trim().length > 0) && (
        <div className="px-4 py-2 bg-slate-50 border-b text-xs text-slate-700 flex items-center justify-between">
          <span>Mostrando <strong>{filtered.length}</strong> de <strong>{rows.length}</strong> registros tras filtros.</span>
          <button type="button" onClick={() => setColumnFilters({})} className="text-red-600 hover:underline text-xs">Limpiar filtros</button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <TableColumnFilterHead
            columns={columnDefs}
            rows={rows}
            filters={columnFilters}
            onFilterChange={onColumnFilterChange}
            filterRowClassName="bg-slate-50"
          />
        </thead>
        <tbody>
          {filtered.map((row, i) => (
            <tr key={i} className="border-b hover:bg-slate-50/50">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

