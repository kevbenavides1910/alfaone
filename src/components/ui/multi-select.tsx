"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/input";

interface Option {
  value: string;
  label: string;
  /** Texto extra para búsqueda (códigos, empresa, etc.). */
  searchText?: string;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  /** Muestra buscador dentro del desplegable. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /**
   * Acciones rápidas encima de la lista (p. ej. «Todas las 03»).
   * `values` se fusionan con la selección actual (sin duplicar).
   */
  quickActions?: Array<{
    id: string;
    label: string;
    values: string[];
  }>;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  className,
  searchable = false,
  searchPlaceholder = "Buscar…",
  quickActions,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function toggle(v: string) {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  function applyQuickAction(values: string[]) {
    const set = new Set(value);
    for (const v of values) set.add(v);
    onChange([...set]);
  }

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const hay = `${opt.label} ${opt.searchText ?? ""} ${opt.value}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  const label =
    value.length === 0
      ? placeholder
      : (() => {
          const names = value.map(
            (v) =>
              options.find((o) => o.value === v)?.label ??
              quickActions?.find((a) => a.values.length === 1 && a.values[0] === v)?.label ??
              v,
          );
          if (names.length <= 3) return names.join(", ");
          return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
        })();

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center justify-between gap-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          value.length > 0 ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="truncate">{label}</span>
        <span className="flex items-center gap-1 shrink-0">
          {value.length > 0 && (
            <X
              className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700"
              onClick={clear}
            />
          )}
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] rounded-md border bg-card shadow-lg">
          {searchable && (
            <div className="border-b p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 pl-8 text-sm"
                  autoFocus
                />
              </div>
            </div>
          )}

          {quickActions && quickActions.length > 0 && (
            <div className="border-b px-2 py-2 flex flex-wrap gap-1.5">
              {quickActions.map((action) => {
                const allSelected =
                  action.values.length > 0 && action.values.every((v) => value.includes(v));
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => {
                      if (allSelected) {
                        const drop = new Set(action.values);
                        onChange(value.filter((v) => !drop.has(v)));
                      } else {
                        applyQuickAction(action.values);
                      }
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      allSelected
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    )}
                    title={
                      allSelected
                        ? "Quitar este grupo de la selección"
                        : "Agregar todas estas planillas a la selección"
                    }
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="max-h-60 overflow-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400">Sin coincidencias</div>
            ) : (
              filteredOptions.map((opt) => {
                const selected = value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        selected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-slate-300"
                      )}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="text-left">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
          {value.length > 0 && (
            <div className="border-t px-3 py-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Limpiar selección (todas las planillas)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
