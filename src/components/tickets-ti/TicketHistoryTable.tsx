"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, History, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/tickets-ti/TicketBadges";
import { formatDate } from "@/lib/utils/format";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";

type TicketHistoryRow = {
  id: string;
  ticketNumber: string;
  title: string;
  requester: { name: string; email: string };
  assignedTo: { id: string; name: string } | null;
  status: { code: string; name: string };
  priority: { code: string; name: string };
  openedAt: string;
};

type HistoryFilters = {
  ticketNumber: string;
  title: string;
  person: string;
};

type PersonColumnMode = "requester" | "technician";

type TicketHistoryTableProps = {
  personColumn?: PersonColumnMode;
};

const PERSON_COLUMN_CONFIG: Record<
  PersonColumnMode,
  { label: string; filterKey: string; placeholder: string; apiParam: "requester" | "technician" }
> = {
  requester: {
    label: "Solicitante",
    filterKey: "requester",
    placeholder: "Nombre solicitante",
    apiParam: "requester",
  },
  technician: {
    label: "Técnico",
    filterKey: "technician",
    placeholder: "Nombre técnico",
    apiParam: "technician",
  },
};

type HistoryResponse = {
  rows: TicketHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const FILTER_INPUT =
  "w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400";

const STICKY_TH =
  "sticky top-0 z-10 bg-slate-50 align-top border-b border-slate-200 shadow-[0_1px_0_0_rgb(226,232,240)]";

const EMPTY_FILTERS: HistoryFilters = { ticketNumber: "", title: "", person: "" };

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function ColumnTextFilter({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative min-w-[88px]" onClick={(e) => e.stopPropagation()}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Filtrar…"}
        className={cn(FILTER_INPUT, value && "pr-7")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          title="Limpiar"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function ColumnHeader({
  label,
  filterKey,
  openCols,
  onToggle,
  active,
  children,
}: {
  label: string;
  filterKey: string;
  openCols: Set<string>;
  onToggle: (key: string) => void;
  active?: boolean;
  children?: React.ReactNode;
}) {
  const isOpen = openCols.has(filterKey);

  return (
    <th className={cn(STICKY_TH, "px-3 py-2 min-w-[120px] text-left")}>
      <button
        type="button"
        onClick={() => onToggle(filterKey)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap hover:text-slate-700 transition-colors",
          active || isOpen ? "text-slate-700" : "text-slate-600"
        )}
        title="Clic para filtrar"
      >
        <span>{label}</span>
        {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />}
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 opacity-50 transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && children && <div className="mt-1.5">{children}</div>}
    </th>
  );
}

function buildPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("ellipsis");
    out.push(sorted[i]);
  }
  return out;
}

export function TicketHistoryTable({ personColumn = "requester" }: TicketHistoryTableProps) {
  const personConfig = PERSON_COLUMN_CONFIG[personColumn];
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [draftFilters, setDraftFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [openCols, setOpenCols] = useState<Set<string>>(new Set());

  const appliedFilters = useDebouncedValue(draftFilters, 350);

  useEffect(() => {
    setPage(1);
  }, [appliedFilters.ticketNumber, appliedFilters.title, appliedFilters.person, personColumn]);

  const toggleCol = useCallback((key: string) => {
    setOpenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    if (appliedFilters.ticketNumber.trim()) p.set("ticketNumber", appliedFilters.ticketNumber.trim());
    if (appliedFilters.title.trim()) p.set("title", appliedFilters.title.trim());
    if (appliedFilters.person.trim()) p.set(personConfig.apiParam, appliedFilters.person.trim());
    return p.toString();
  }, [page, pageSize, appliedFilters, personConfig.apiParam]);

  const { data, isLoading, error } = useQuery<{ data: HistoryResponse }>({
    queryKey: ["tickets-ti-history", personColumn, queryParams],
    queryFn: async () => {
      const r = await fetch(`/api/tickets-ti?${queryParams}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const payload = data?.data;
  const rows = payload?.rows ?? [];
  const totalPages = payload?.totalPages ?? 1;
  const total = payload?.total ?? 0;
  const pageNumbers = buildPageNumbers(page, totalPages);

  const hasActiveFilters =
    Boolean(draftFilters.ticketNumber.trim()) ||
    Boolean(draftFilters.title.trim()) ||
    Boolean(draftFilters.person.trim());

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setOpenCols(new Set());
  };

  // Column filters (table-column-filters)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const onColumnFilterChange = (k: string, v: string) => setColumnFilters((p) => ({ ...p, [k]: v }));

  const columnDefs = useMemo((): TableColumnFilterDef<TicketHistoryRow>[] => {
    return [
      { key: "ticketNumber", label: "N° ticket", getValue: (r) => r.ticketNumber },
      { key: "title", label: "Encabezado", getValue: (r) => r.title },
      { key: personConfig.filterKey, label: personConfig.label, getValue: (r) => (personColumn === "technician" ? r.assignedTo?.name ?? "" : r.requester.name) },
      { key: "status", label: "Estado", getValue: (r) => r.status.name },
      { key: "priority", label: "Prioridad", getValue: (r) => r.priority.name },
      { key: "openedAt", label: "Apertura", getValue: (r) => formatDate(r.openedAt) },
      { key: "actions", label: "", filterable: false, getValue: () => "" },
    ];
  }, [personColumn]);

  const displayedRows = useMemo(
    () =>
      filterRowsByColumnFilters(
        rows,
        columnFilters,
        columnDefs.map((c) => ({ key: c.key, getValue: c.getValue, mode: c.mode, filterable: c.filterable }))
      ),
    [rows, columnDefs, columnFilters]
  );
  const columnFilterKeys = useMemo(() => columnDefs.map((c) => c.key), [columnDefs]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-600" />
            Historial de tickets
          </CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Clic en el encabezado de columna para buscar. Clic en el número abre el detalle en una pestaña nueva.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[480px] overflow-auto border-t border-slate-200">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              {hasActiveColumnFilters(columnFilters) && (
                <tr>
                  <th colSpan={7} className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setColumnFilters(clearColumnFilters(columnFilterKeys))}>
                      Limpiar filtros
                    </Button>
                  </th>
                </tr>
              )}
              <TableColumnFilterHead
                columns={columnDefs}
                rows={rows}
                filters={columnFilters}
                onFilterChange={onColumnFilterChange}
                headerRowClassName=""
                filterRowClassName="bg-slate-50"
              />
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    Cargando historial…
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-red-600">
                    {(error as Error).message}
                  </td>
                </tr>
              )}
              {!isLoading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No hay tickets que coincidan con los filtros.
                  </td>
                </tr>
              )}
              {displayedRows.map((ticket) => (
                <tr key={ticket.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="px-3 py-2.5">
                    <a
                      href={`/tickets-ti/${ticket.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-indigo-700 hover:underline font-medium"
                      title="Abrir detalle en nueva pestaña"
                    >
                      {ticket.ticketNumber}
                    </a>
                  </td>
                  <td className="px-3 py-2.5 text-slate-800 max-w-[280px]">
                    <span className="line-clamp-2">{ticket.title}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    {personColumn === "technician"
                      ? ticket.assignedTo?.name ?? "—"
                      : ticket.requester.name}
                  </td>
                  <td className="px-3 py-2.5">
                    <TicketStatusBadge code={ticket.status.code} name={ticket.status.name} />
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell">
                    <TicketPriorityBadge code={ticket.priority.code} name={ticket.priority.name} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 hidden md:table-cell whitespace-nowrap">
                    {formatDate(ticket.openedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 text-sm">
            <span className="text-slate-500 text-xs">
              {total === 0
                ? "Sin resultados"
                : `Mostrando ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`}
            </span>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                {pageNumbers.map((n, i) =>
                  n === "ellipsis" ? (
                    <span key={`e-${i}`} className="px-1 text-slate-400 text-xs">
                      …
                    </span>
                  ) : (
                    <Button
                      key={n}
                      variant={n === page ? "default" : "outline"}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
