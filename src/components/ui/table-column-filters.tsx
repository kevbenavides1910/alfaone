"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ResizableTh } from "@/components/ui/resizable-th";
import { useResizableTableColumns } from "@/lib/hooks/use-resizable-table-columns";
import {
  parseColumnMultiFilter,
  resolveColumnFilterOptions,
  serializeColumnMultiFilter,
  type ColumnFilterOption,
} from "@/lib/table/column-filters";

const FILTER_INPUT_CLASS =
  "w-full h-7 text-xs border border-border rounded px-2 pr-6 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-400 dark:bg-background";

const FILTER_SELECT_CLASS =
  "w-full h-7 text-xs border border-border rounded px-1.5 bg-card text-foreground focus:outline-none focus:border-red-400 dark:bg-background";

export function ColumnFilterInput({
  value,
  onChange,
  placeholder = "Buscar…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-[4.5rem]", className)}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={FILTER_INPUT_CLASS}
        aria-label={placeholder}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          title="Limpiar filtro"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

export function ColumnFilterMultiSelect({
  value,
  onChange,
  options,
  allLabel = "Todos",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ColumnFilterOption[];
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = parseColumnMultiFilter(value);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function toggle(optionValue: string) {
    const next = selected.includes(optionValue)
      ? selected.filter((v) => v !== optionValue)
      : [...selected, optionValue];
    onChange(serializeColumnMultiFilter(next));
  }

  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} sel.`;

  return (
    <div ref={ref} className={cn("relative min-w-[4.5rem]", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          FILTER_SELECT_CLASS,
          "flex items-center justify-between gap-1 pr-1",
          selected.length > 0 ? "text-foreground" : "text-muted-foreground",
        )}
        aria-label={allLabel}
      >
        <span className="truncate text-left flex-1">{label}</span>
        <span className="flex items-center gap-0.5 shrink-0">
          {selected.length > 0 ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }
              }}
              className="text-slate-400 hover:text-slate-700"
              title="Limpiar filtro"
            >
              <X className="h-3 w-3" />
            </span>
          ) : null}
          <ChevronDown
            className={cn("h-3 w-3 text-slate-400 transition-transform", open && "rotate-180")}
          />
        </span>
      </button>

      {open ? (
        <div className="absolute z-[80] left-0 mt-0.5 min-w-full w-max max-w-[16rem] rounded-md border border-slate-200 bg-card shadow-lg">
          <div className="max-h-48 overflow-auto py-1">
            {options.map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/50 text-left"
                >
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-slate-300",
                    )}
                  >
                    {isSelected ? <Check className="h-2.5 w-2.5" /> : null}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
          {selected.length > 0 ? (
            <div className="border-t px-2 py-1.5">
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-[11px] text-slate-500 hover:text-slate-700"
              >
                Limpiar selección
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Usar ColumnFilterMultiSelect */
export function ColumnFilterSelect({
  value,
  onChange,
  options,
  allLabel = "Todos",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ColumnFilterOption[];
  allLabel?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(FILTER_SELECT_CLASS, className)}
      aria-label={allLabel}
    >
      <option value="">{allLabel}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function ColumnFilterControl({
  value,
  onChange,
  mode,
  options,
  placeholder = "Buscar…",
  allLabel = "Todos",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  mode: "select" | "search";
  options?: ColumnFilterOption[];
  placeholder?: string;
  allLabel?: string;
  className?: string;
}) {
  if (mode === "select" && options && options.length > 0) {
    return (
      <ColumnFilterMultiSelect
        value={value}
        onChange={onChange}
        options={options}
        allLabel={allLabel}
        className={className}
      />
    );
  }
  return (
    <ColumnFilterInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  );
}

export type TableColumnFilterDef<T> = {
  key: string;
  label: React.ReactNode;
  align?: "left" | "right" | "center";
  headerClassName?: string;
  filterClassName?: string;
  /** Estilos del <th> de título (p. ej. sticky left/width). */
  headerStyle?: React.CSSProperties;
  /** Estilos del <th> de filtro. */
  filterStyle?: React.CSSProperties;
  filterable?: boolean;
  placeholder?: string;
  allLabel?: string;
  getValue: (row: T) => unknown;
  formatValue?: (value: unknown, row: T) => string;
  options?: ColumnFilterOption[];
  mode?: "select" | "search";
};

export function useTableColumnFilters<T>(rows: T[], columns: TableColumnFilterDef<T>[]) {
  const columnMeta = useMemo(
    () =>
      columns.map((col) => {
        if (col.filterable === false) {
          return { ...col, resolvedMode: "search" as const, resolvedOptions: [] as ColumnFilterOption[] };
        }
        if (col.mode) {
          return {
            ...col,
            resolvedMode: col.mode,
            resolvedOptions: col.options ?? [],
          };
        }
        const resolved = resolveColumnFilterOptions(rows, col.getValue, col.options, col.formatValue);
        return { ...col, resolvedMode: resolved.mode, resolvedOptions: resolved.options };
      }),
    [rows, columns]
  );

  return { columnMeta };
}

type TableColumnFilterHeadProps<T> = {
  columns: TableColumnFilterDef<T>[];
  rows: T[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  headerRowClassName?: string;
  filterRowClassName?: string;
  showFilterRow?: boolean;
  /**
   * Id estable para persistir anchos de columna en localStorage.
   * Si se omite, el enhancer global de layout igualmente permite redimensionar.
   */
  tableId?: string;
  /** Anchos iniciales sugeridos (px) por column.key. */
  defaultColumnWidths?: Record<string, number>;
};

/** Encabezado de tabla con fila de títulos y fila de filtros por columna. */
export function TableColumnFilterHead<T>({
  columns,
  rows,
  filters,
  onFilterChange,
  headerRowClassName,
  filterRowClassName,
  showFilterRow = true,
  tableId,
  defaultColumnWidths,
}: TableColumnFilterHeadProps<T>) {
  const { columnMeta } = useTableColumnFilters(rows, columns);
  const resize = useResizableTableColumns(tableId ?? "__no-persist__");
  const persist = Boolean(tableId);

  return (
    <>
      <tr className={headerRowClassName}>
        {columnMeta.map((col) => {
          const width = persist
            ? resize.getWidth(col.key, defaultColumnWidths?.[col.key])
            : defaultColumnWidths?.[col.key];
          return (
            <ResizableTh
              key={col.key}
              columnKey={col.key}
              className={col.headerClassName}
              style={{ textAlign: col.align ?? "left", ...col.headerStyle }}
              width={width}
              resizable={persist}
              onResizeWidth={persist ? resize.setColumnWidth : undefined}
            >
              {col.label}
            </ResizableTh>
          );
        })}
      </tr>
      {showFilterRow ? (
        <tr className={filterRowClassName ?? "bg-muted/40 border-b"}>
          {columnMeta.map((col) => {
            const width = persist
              ? resize.getWidth(col.key, defaultColumnWidths?.[col.key])
              : defaultColumnWidths?.[col.key];
            return (
              <th
                key={`${col.key}-filter`}
                data-col-key={col.key}
                className={cn("px-2 py-1.5 font-normal", col.filterClassName ?? col.headerClassName)}
                style={{
                  textAlign: col.align ?? "left",
                  ...col.filterStyle,
                  ...(width != null
                    ? { width, minWidth: width, maxWidth: width }
                    : null),
                }}
              >
                {col.filterable === false ? null : (
                  <ColumnFilterControl
                    value={filters[col.key] ?? ""}
                    onChange={(v) => onFilterChange(col.key, v)}
                    mode={col.resolvedMode}
                    options={col.resolvedOptions}
                    placeholder={col.placeholder ?? "Buscar…"}
                    allLabel={col.allLabel ?? "Todos"}
                  />
                )}
              </th>
            );
          })}
        </tr>
      ) : null}
    </>
  );
}

export function hasActiveColumnFilters(filters: Record<string, string>): boolean {
  return Object.values(filters).some((v) => v.trim().length > 0);
}

export function clearColumnFilters(keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, ""]));
}
