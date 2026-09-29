"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, Target } from "lucide-react";
import { useSession } from "@/lib/auth/client-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { formatDate } from "@/lib/utils/format";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { hasPermission } from "@/lib/permissions/check";
import {
  VENTAS_OPORTUNIDAD_ESTADO_LABELS,
  VENTAS_OPORTUNIDAD_ESTADO_OPTIONS,
  type VentasOportunidadEstado,
} from "@/modules/ventas/client";

type OportunidadRow = {
  id: string;
  licitacionNo: string;
  cliente: string;
  descripcion: string;
  fechaPresentacion: string;
  enlace: string | null;
  estado: VentasOportunidadEstado;
  source: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  createdAt: string;
  inicioRecepcion: string | null;
  cierreRecepcion: string | null;
  montoContratacion: string | null;
  monedaContratacion: string | null;
  fechaAclaracion: string | null;
  fechaObjeciones: string | null;
  sicopUpdatedAt: string | null;
};

type ListResponse = {
  data: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    rows: OportunidadRow[];
    resumenEstado: Record<string, number>;
  };
};

const TABLE_ID = "ventas-oportunidades";

function formatMonto(value: string | null, moneda: string | null) {
  if (!value) return "—";
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return value;
  return `${n.toLocaleString("es-CR")} ${moneda ?? ""}`.trim();
}

function estadoBadge(estado: VentasOportunidadEstado) {
  if (estado === "PENDIENTE_DECIDIR") {
    return <Badge className="bg-amber-500 hover:bg-amber-500">Pendiente de decidir</Badge>;
  }
  if (estado === "PARTICIPAR") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Participar</Badge>;
  }
  return <Badge variant="secondary">No participar</Badge>;
}

export default function OportunidadesPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const canEdit = hasPermission(session, "ventas.oportunidades", "edit");

  const [q, setQ] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    licitacionNo: "",
    cliente: "",
    descripcion: "",
    fechaPresentacion: "",
    enlace: "",
  });

  const queryParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    if (q.trim()) sp.set("q", q.trim());
    if (estadoFilter) sp.set("estado", estadoFilter);
    return sp.toString();
  }, [q, estadoFilter, page]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["ventas-oportunidades", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/ventas/oportunidades?${queryParams}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Error al cargar oportunidades");
      return (await res.json()) as ListResponse;
    },
    placeholderData: keepPreviousData,
  });

  const updateEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: VentasOportunidadEstado }) => {
      const res = await fetch(`/api/ventas/oportunidades/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(err?.error?.message ?? "No se pudo actualizar el estado");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas-oportunidades"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ventas/oportunidades", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licitacionNo: form.licitacionNo.trim(),
          cliente: form.cliente.trim(),
          descripcion: form.descripcion.trim(),
          fechaPresentacion: form.fechaPresentacion,
          enlace: form.enlace.trim() || undefined,
          source: "manual",
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(err?.error?.message ?? "No se pudo crear la oportunidad");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas-oportunidades"] });
      setShowCreate(false);
      setForm({ licitacionNo: "", cliente: "", descripcion: "", fechaPresentacion: "", enlace: "" });
    },
  });

  const rows = data?.data.rows ?? [];
  const payload = data?.data;
  const resumen = payload?.resumenEstado ?? {};

  const lastSicopSync = useMemo(() => {
    let max: string | null = null;
    for (const row of rows) {
      if (row.sicopUpdatedAt && (!max || row.sicopUpdatedAt > max)) max = row.sicopUpdatedAt;
    }
    return max;
  }, [rows]);

  const onColumnFilterChange = (key: string, value: string) =>
    setColumnFilters((prev) => ({ ...prev, [key]: value }));

  const columnDefs = useMemo((): TableColumnFilterDef<OportunidadRow>[] => {
    return [
      { key: "licitacionNo", label: "Nº licitación", getValue: (r) => r.licitacionNo },
      { key: "cliente", label: "Cliente", getValue: (r) => r.cliente },
      { key: "descripcion", label: "Descripción", getValue: (r) => r.descripcion },
      { key: "fechaPresentacion", label: "Fecha presentación", getValue: (r) => formatDate(r.fechaPresentacion) },
      {
        key: "inicioRecepcion",
        label: "Inicio recepción",
        getValue: (r) => (r.inicioRecepcion ? formatDate(r.inicioRecepcion) : ""),
      },
      {
        key: "cierreRecepcion",
        label: "Cierre recepción",
        getValue: (r) => (r.cierreRecepcion ? formatDate(r.cierreRecepcion) : ""),
      },
      {
        key: "montoContratacion",
        label: "Monto contratación",
        getValue: (r) => formatMonto(r.montoContratacion, r.monedaContratacion),
      },
      {
        key: "fechaAclaracion",
        label: "Fecha aclaración",
        getValue: (r) => (r.fechaAclaracion ? formatDate(r.fechaAclaracion) : ""),
      },
      {
        key: "fechaObjeciones",
        label: "Fecha objeciones",
        getValue: (r) => (r.fechaObjeciones ? formatDate(r.fechaObjeciones) : ""),
      },
      { key: "enlace", label: "Enlace", getValue: (r) => r.enlace ?? "", filterable: false },
      {
        key: "estado",
        label: "Estado",
        getValue: (r) => VENTAS_OPORTUNIDAD_ESTADO_LABELS[r.estado],
      },
      {
        key: "sicopUpdatedAt",
        label: "Sync SICOP",
        getValue: (r) => (r.sicopUpdatedAt ? formatDate(r.sicopUpdatedAt) : ""),
      },
      {
        key: "decision",
        label: "Decisión",
        getValue: (r) =>
          r.decidedByName
            ? `${r.decidedByName}${r.decidedAt ? ` · ${formatDate(r.decidedAt)}` : ""}`
            : r.source
              ? `Auto (${r.source})`
              : "",
      },
    ];
  }, []);

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

  function handleExport() {
    exportRowsToExcel({
      filename: "oportunidades_licitaciones",
      sheetName: "Oportunidades",
      rows: displayedRows.map((r) => ({
        "Nº licitación": r.licitacionNo,
        Cliente: r.cliente,
        Descripción: r.descripcion,
        "Fecha presentación": formatDate(r.fechaPresentacion),
        "Inicio recepción": r.inicioRecepcion ? formatDate(r.inicioRecepcion) : "",
        "Cierre recepción": r.cierreRecepcion ? formatDate(r.cierreRecepcion) : "",
        "Monto contratación": formatMonto(r.montoContratacion, r.monedaContratacion),
        "Fecha aclaración": r.fechaAclaracion ? formatDate(r.fechaAclaracion) : "",
        "Fecha objeciones": r.fechaObjeciones ? formatDate(r.fechaObjeciones) : "",
        "Sync SICOP": r.sicopUpdatedAt ? formatDate(r.sicopUpdatedAt) : "",
        Estado: VENTAS_OPORTUNIDAD_ESTADO_LABELS[r.estado],
        Enlace: r.enlace ?? "",
        Origen: r.source ?? "",
        "Decidido por": r.decidedByName ?? "",
        "Fecha decisión": r.decidedAt ? formatDate(r.decidedAt) : "",
        Registrado: formatDate(r.createdAt),
      })),
      columnWidths: [18, 24, 40, 16, 16, 16, 18, 16, 16, 14, 18, 30, 10, 18, 16, 14],
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-800">
            <Target className="h-5 w-5 text-violet-600" />
            <h1 className="text-xl font-semibold">Oportunidades de licitación</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Pipeline de licitaciones: ingreso automático desde SICOP (n8n / cron diario) o registro manual.
            Marque cada oportunidad como participar o no participar antes de elaborar el presupuesto.
          </p>
          {lastSicopSync && (
            <p className="text-xs text-muted-foreground mt-1">
              Última sync SICOP en esta página: {formatDate(lastSicopSync)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="h-4 w-4 mr-1" />
              Nueva oportunidad
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={displayedRows.length === 0}
            onClick={handleExport}
          >
            Exportar Excel ({displayedRows.length})
          </Button>
        </div>
      </div>

      {showCreate && canEdit && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 max-w-2xl">
          <h2 className="font-medium text-sm">Registrar oportunidad manual</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Número de licitación</label>
              <Input
                value={form.licitacionNo}
                onChange={(e) => setForm((f) => ({ ...f, licitacionNo: e.target.value }))}
                placeholder="2025LY-000006-0006100001"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Cliente / institución</label>
              <Input
                value={form.cliente}
                onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))}
                placeholder="PANI, CCSS, etc."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fecha de presentación</label>
              <Input
                type="date"
                value={form.fechaPresentacion}
                onChange={(e) => setForm((f) => ({ ...f, fechaPresentacion: e.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Descripción del servicio</label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Contratación de servicio de seguridad y vigilancia…"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Enlace SICOP (opcional)</label>
              <Input
                value={form.enlace}
                onChange={(e) => setForm((f) => ({ ...f, enlace: e.target.value }))}
                placeholder="https://…"
              />
            </div>
          </div>
          <Button
            size="sm"
            disabled={
              createMutation.isPending ||
              !form.licitacionNo.trim() ||
              !form.cliente.trim() ||
              !form.descripcion.trim() ||
              !form.fechaPresentacion
            }
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Guardando…" : "Registrar oportunidad"}
          </Button>
          {createMutation.isError && (
            <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-sm"
          placeholder="Buscar licitación, cliente o descripción…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="h-9 text-sm border rounded-md px-2 bg-background"
          value={estadoFilter}
          onChange={(e) => {
            setEstadoFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los estados</option>
          {VENTAS_OPORTUNIDAD_ESTADO_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {isFetching && !isLoading && (
          <span className="text-xs text-muted-foreground">Filtrando…</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
          Pendientes: {resumen.PENDIENTE_DECIDIR ?? 0}
        </Badge>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200">
          Participar: {resumen.PARTICIPAR ?? 0}
        </Badge>
        <Badge variant="outline">No participar: {resumen.NO_PARTICIPAR ?? 0}</Badge>
      </div>

      <div
        className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-opacity ${
          isFetching && !isLoading ? "opacity-70" : ""
        }`}
      >
        <div className="max-h-[calc(100vh-13rem)] overflow-auto">
          {hasActiveColumnFilters(columnFilters) && (
            <div className="flex justify-end px-3 py-1.5 border-b bg-slate-50">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setColumnFilters(clearColumnFilters(columnFilterKeys))}
              >
                Limpiar filtros de columnas
              </Button>
            </div>
          )}
          <table data-table-id={TABLE_ID} className="w-full text-sm table-fixed">
            <thead>
              <TableColumnFilterHead
                tableId={TABLE_ID}
                defaultColumnWidths={{
                  licitacionNo: 150,
                  cliente: 220,
                  descripcion: 280,
                  fechaPresentacion: 120,
                  inicioRecepcion: 120,
                  cierreRecepcion: 120,
                  montoContratacion: 130,
                  fechaAclaracion: 120,
                  fechaObjeciones: 120,
                  enlace: 80,
                  estado: 150,
                  sicopUpdatedAt: 110,
                  decision: 180,
                }}
                columns={columnDefs}
                rows={rows}
                filters={columnFilters}
                onFilterChange={onColumnFilterChange}
                filterRowClassName="bg-slate-50"
              />
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-muted-foreground">
                    Cargando oportunidades…
                  </td>
                </tr>
              )}
              {!isLoading && displayedRows.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-muted-foreground">
                    No hay oportunidades con los filtros actuales.
                  </td>
                </tr>
              )}
              {displayedRows.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium whitespace-nowrap align-top" title={row.licitacionNo}>
                    {row.licitacionNo}
                  </td>
                  <td className="px-3 py-2 align-top whitespace-normal break-words" title={row.cliente}>
                    {row.cliente}
                  </td>
                  <td className="px-3 py-2 align-top whitespace-normal break-words" title={row.descripcion}>
                    {row.descripcion}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap align-top">
                    {formatDate(row.fechaPresentacion)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap align-top text-xs">
                    {row.inicioRecepcion ? (
                      formatDate(row.inicioRecepcion)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap align-top text-xs">
                    {row.cierreRecepcion ? (
                      formatDate(row.cierreRecepcion)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap align-top text-xs">
                    {row.montoContratacion ? (
                      formatMonto(row.montoContratacion, row.monedaContratacion)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap align-top text-xs">
                    {row.fechaAclaracion ? (
                      formatDate(row.fechaAclaracion)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap align-top text-xs">
                    {row.fechaObjeciones ? (
                      formatDate(row.fechaObjeciones)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.enlace ? (
                      <a
                        href={row.enlace}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline whitespace-nowrap"
                      >
                        Ver <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {canEdit ? (
                      <Select
                        value={row.estado}
                        disabled={updateEstado.isPending}
                        onValueChange={(estado) =>
                          updateEstado.mutate({
                            id: row.id,
                            estado: estado as VentasOportunidadEstado,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-full max-w-[11.5rem] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VENTAS_OPORTUNIDAD_ESTADO_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      estadoBadge(row.estado)
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap align-top">
                    {row.sicopUpdatedAt ? formatDate(row.sicopUpdatedAt) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground align-top whitespace-normal break-words">
                    {row.decidedByName ? (
                      <>
                        {row.decidedByName}
                        {row.decidedAt ? ` · ${formatDate(row.decidedAt)}` : ""}
                      </>
                    ) : row.source ? (
                      `Auto (${row.source})`
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payload && payload.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {payload.page} de {payload.totalPages} ({payload.total} registros)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= payload.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
