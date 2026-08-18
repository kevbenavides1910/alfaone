"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import type { ColumnMeta, DataRow } from "@/modules/tickets-ti/report-viewer/types";
import { REPORT_VIEWER_CONFIG } from "@/modules/tickets-ti/report-viewer/config/report-viewer.config";
import { findColumnByPattern } from "@/modules/tickets-ti/report-viewer/engine/filter-engine";
import { PATTERNS } from "@/modules/tickets-ti/report-viewer/engine/kpi-calculator";

type Props = {
  rows: DataRow[];
  columns: ColumnMeta[];
  isDark: boolean;
};

function rowSeverityClass(row: DataRow, statusCol?: string, severityCol?: string): string {
  const status = statusCol ? String(row[statusCol] ?? "") : "";
  const severity = severityCol ? String(row[severityCol] ?? "") : "";
  if (/cerrad|resuelt|closed/i.test(status)) return "bg-emerald-50/80 dark:bg-emerald-950/30";
  if (/alta|cr[ií]tic|urgent/i.test(severity)) return "bg-red-50/80 dark:bg-red-950/30";
  if (/proceso|asignad|open|abiert/i.test(status)) return "bg-amber-50/60 dark:bg-amber-950/20";
  return "";
}

export function ReportViewerDataTable({ rows, columns, isDark }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const tableColumns = useMemo<ColumnDef<DataRow>[]>(
    () =>
      columns.map((col) => ({
        id: col.id,
        accessorKey: col.id,
        header: col.label,
        cell: ({ getValue }) => {
          const v = getValue();
          return v == null ? "—" : String(v);
        },
      })),
    [columns]
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: REPORT_VIEWER_CONFIG.pageSize } },
  });

  const statusCol = findColumnByPattern(columns, PATTERNS.status)?.id;
  const severityCol = findColumnByPattern(columns, PATTERNS.severity)?.id;

  function filteredDataRows(): DataRow[] {
    return table.getFilteredRowModel().rows.map((r) => r.original);
  }

  function exportCsv() {
    const data = filteredDataRows();
    const headers = columns.map((c) => c.label);
    const lines = [
      headers.join(","),
      ...data.map((r) =>
        columns.map((c) => `"${String(r[c.id] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_tickets_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    exportRowsToExcel({
      filename: "reporte_tickets",
      sheetName: "Datos",
      rows: filteredDataRows().map((r) => {
        const out: Record<string, string | number | null> = {};
        columns.forEach((c) => {
          out[c.label] = r[c.id] == null ? null : String(r[c.id]);
        });
        return out;
      }),
    });
  }

  function printTable() {
    window.print();
  }

  function copyTable() {
    const data = filteredDataRows();
    const headers = columns.map((c) => c.label).join("\t");
    const body = data
      .map((r) => columns.map((c) => String(r[c.id] ?? "")).join("\t"))
      .join("\n");
    void navigator.clipboard.writeText(`${headers}\n${body}`);
  }

  const border = isDark ? "border-slate-800" : "border-slate-200";

  return (
    <div className={`rounded-xl border ${border} overflow-hidden ${isDark ? "bg-slate-900/40" : "bg-white"}`}>
      <div className="flex flex-wrap gap-2 p-3 border-b border-inherit items-center justify-between">
        <input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Buscar en tabla…"
          className="h-8 text-xs rounded-md border px-2 min-w-[200px] bg-transparent"
        />
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyTable}>
            Copiar
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={printTable}>
            Imprimir / PDF
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCsv}>
            CSV
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportExcel}>
            Excel
          </Button>
        </div>
      </div>

      <div className="px-3 py-2 flex flex-wrap gap-2 border-b border-inherit">
        {columns.map((col) => (
          <label key={col.id} className="flex items-center gap-1 text-[11px] text-slate-500">
            <input
              type="checkbox"
              checked={table.getColumn(col.id)?.getIsVisible() !== false}
              onChange={() => table.getColumn(col.id)?.toggleVisibility()}
            />
            {col.label}
          </label>
        ))}
      </div>

      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-xs">
          <thead className={`sticky top-0 z-10 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-semibold cursor-pointer whitespace-nowrap"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={`border-t border-inherit ${rowSeverityClass(row.original, statusCol, severityCol)}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 whitespace-nowrap max-w-[280px] truncate">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-t border-inherit text-xs">
        <span>
          {table.getFilteredRowModel().rows.length.toLocaleString("es")} filas · Página{" "}
          {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
        </span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
