"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ColumnMeta, ColumnDataType, FilterState, DataRow } from "@/modules/tickets-ti/report-viewer/types";
import { uniqueColumnValues } from "@/modules/tickets-ti/report-viewer/engine/filter-engine";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";

function defaultFilter(type: ColumnDataType): FilterState[string] {
  if (type === "boolean") return { kind: "boolean", value: null };
  if (type === "date" || type === "datetime") return { kind: "dateRange", from: "", to: "" };
  if (type === "number" || type === "decimal" || type === "currency" || type === "percent") {
    return { kind: "numberRange", min: "", max: "" };
  }
  return { kind: "text", value: "" };
}

type Props = {
  columns: ColumnMeta[];
  rows: DataRow[];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  isDark: boolean;
};

export function ReportViewerFilters({ columns, rows, filters, onChange, isDark }: Props) {
  function setColumnFilter(colId: string, value: FilterState[string]) {
    onChange({ ...filters, [colId]: value });
  }

  function clearAll() {
    onChange({});
  }

  const panelClass = isDark
    ? "border-slate-800 bg-slate-900/50"
    : "border-slate-200 bg-white";

  return (
    <div className={`rounded-xl border p-4 space-y-4 ${panelClass}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Filtros dinámicos</h3>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={clearAll}>
          Limpiar filtros
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {columns.map((col) => {
          const f = filters[col.id] ?? defaultFilter(col.type);
          const options = col.type === "text" ? uniqueColumnValues(rows, col.id, 200) : [];

          return (
            <div key={col.id} className="space-y-1.5">
              <Label className="text-xs">{col.label}</Label>
              {f.kind === "text" && (
                <input
                  className="w-full h-8 text-xs rounded-md border px-2 bg-transparent"
                  value={f.value}
                  onChange={(e) => setColumnFilter(col.id, { kind: "text", value: e.target.value })}
                  placeholder="Buscar…"
                />
              )}
              {f.kind === "multiselect" && (
                <select
                  multiple
                  className="w-full min-h-[72px] text-xs rounded-md border px-2 bg-transparent"
                  value={f.values}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setColumnFilter(col.id, { kind: "multiselect", values });
                  }}
                >
                  {options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
              {f.kind === "dateRange" && (
                <div className="space-y-1">
                  <CalendarDateInput
                    value={f.from}
                    onChange={(v) => setColumnFilter(col.id, { ...f, from: v })}
                    placeholder="Desde"
                    className="h-8 text-xs"
                  />
                  <CalendarDateInput
                    value={f.to}
                    onChange={(v) => setColumnFilter(col.id, { ...f, to: v })}
                    placeholder="Hasta"
                    className="h-8 text-xs"
                  />
                </div>
              )}
              {f.kind === "numberRange" && (
                <div className="flex gap-1">
                  <input
                    type="number"
                    className="w-full h-8 text-xs rounded-md border px-2 bg-transparent"
                    placeholder="Min"
                    value={f.min}
                    onChange={(e) => setColumnFilter(col.id, { ...f, min: e.target.value })}
                  />
                  <input
                    type="number"
                    className="w-full h-8 text-xs rounded-md border px-2 bg-transparent"
                    placeholder="Max"
                    value={f.max}
                    onChange={(e) => setColumnFilter(col.id, { ...f, max: e.target.value })}
                  />
                </div>
              )}
              {f.kind === "boolean" && (
                <select
                  className="w-full h-8 text-xs rounded-md border px-2 bg-transparent"
                  value={f.value == null ? "" : f.value ? "true" : "false"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setColumnFilter(col.id, {
                      kind: "boolean",
                      value: v === "" ? null : v === "true",
                    });
                  }}
                >
                  <option value="">Todos</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
