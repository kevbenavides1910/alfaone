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
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { formatDate } from "@/lib/utils/format";
import { hasPermission } from "@/lib/permissions/check";
import {
  VENTAS_OPORTUNIDAD_ESTADO_LABELS,
  VENTAS_OPORTUNIDAD_ESTADO_OPTIONS,
  type VentasOportunidadEstado,
} from "@/modules/ventas/client";
import {
  EMPTY_OPORTUNIDAD_FILTERS,
  OportunidadesListFilters,
  filterOportunidadRows,
  useDebouncedOportunidadFilters,
} from "@/components/ventas/OportunidadesListFilters";

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

  const { draft, setDraft, applied, clearAll } = useDebouncedOportunidadFilters();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
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
    if (applied.q.trim()) sp.set("q", applied.q.trim());
    if (applied.licitacionNo.trim()) sp.set("licitacionNo", applied.licitacionNo.trim());
    if (applied.cliente.trim()) sp.set("cliente", applied.cliente.trim());
    if (applied.estado) sp.set("estado", applied.estado);
    if (applied.fechaDesde) sp.set("fechaDesde", applied.fechaDesde);
    if (applied.fechaHasta) sp.set("fechaHasta", applied.fechaHasta);
    return sp.toString();
  }, [applied, page]);

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

  const payload = data?.data;
  const filteredRows = useMemo(
    () => filterOportunidadRows(payload?.rows ?? [], draft),
    [payload?.rows, draft]
  );

  const resumen = payload?.resumenEstado ?? {};

  function handleExport() {
    exportRowsToExcel({
      filename: "oportunidades_licitaciones",
      sheetName: "Oportunidades",
      rows: filteredRows.map((r) => ({
        "Nº licitación": r.licitacionNo,
        Cliente: r.cliente,
        Descripción: r.descripcion,
        "Fecha presentación": formatDate(r.fechaPresentacion),
        "Inicio recepción": r.inicioRecepcion ? formatDate(r.inicioRecepcion) : "",
        "Cierre recepción": r.cierreRecepcion ? formatDate(r.cierreRecepcion) : "",
        "Monto contratación": r.montoContratacion ? parseFloat(r.montoContratacion).toLocaleString("es-CR") + " " + (r.monedaContratacion || "") : "",
        "Fecha aclaración": r.fechaAclaracion ? formatDate(r.fechaAclaracion) : "",
        "Fecha objeciones": r.fechaObjeciones ? formatDate(r.fechaObjeciones) : "",
        Estado: VENTAS_OPORTUNIDAD_ESTADO_LABELS[r.estado],
        Enlace: r.enlace ?? "",
        Origen: r.source ?? "",
        "Decidido por": r.decidedByName ?? "",
        "Fecha decisión": r.decidedAt ? formatDate(r.decidedAt) : "",
        Registrado: formatDate(r.createdAt),
      })),
      columnWidths: [18, 24, 40, 16, 16, 16, 18, 16, 16, 18, 30, 10, 18, 16, 14],
    });
  }

  return (
    <div className="p-4 md:p-3 sm:p-6 space-y-4 sm:space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-800">
            <Target className="h-5 w-5 text-violet-600" />
            <h1 className="text-xl font-semibold">Oportunidades de licitación</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Pipeline de licitaciones: ingreso automático (n8n) o registro manual. Marque cada oportunidad
            como participar o no participar antes de elaborar el presupuesto.
          </p>
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
            disabled={filteredRows.length === 0}
            onClick={handleExport}
          >
            Exportar Excel ({filteredRows.length})
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

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
          Pendientes: {resumen.PENDIENTE_DECIDIR ?? 0}
        </Badge>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200">
          Participar: {resumen.PARTICIPAR ?? 0}
        </Badge>
        <Badge variant="outline">
          No participar: {resumen.NO_PARTICIPAR ?? 0}
        </Badge>
        {isFetching && !isLoading && (
          <span className="text-muted-foreground self-center">Filtrando…</span>
        )}
      </div>

      <div
        className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-opacity ${
          isFetching && !isLoading ? "opacity-70" : ""
        }`}
      >
        <div className="max-h-[calc(100vh-13rem)] overflow-auto">
          <table className="w-full text-sm">
            <OportunidadesListFilters
              draft={draft}
              setDraft={(next) => {
                setDraft(next);
                setPage(1);
              }}
              clearAll={() => {
                clearAll();
                setPage(1);
              }}
            />
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                    Cargando oportunidades…
                  </td>
                </tr>
              )}
              {!isLoading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                    No hay oportunidades con los filtros actuales.
                  </td>
                </tr>
              )}
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{row.licitacionNo}</td>
                  <td className="px-3 py-2">{row.cliente}</td>
                  <td className="px-3 py-2 max-w-xs">
                    <p className="line-clamp-2" title={row.descripcion}>
                      {row.descripcion}
                    </p>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDate(row.fechaPresentacion)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {row.inicioRecepcion ? formatDate(row.inicioRecepcion) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {row.cierreRecepcion ? formatDate(row.cierreRecepcion) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {row.montoContratacion
                      ? parseFloat(row.montoContratacion).toLocaleString("es-CR") + " " + (row.monedaContratacion || "")
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {row.fechaAclaracion ? formatDate(row.fechaAclaracion) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {row.fechaObjeciones ? formatDate(row.fechaObjeciones) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {row.enlace ? (
                      <a
                        href={row.enlace}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        Ver <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
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
                        <SelectTrigger className="h-8 w-[11.5rem] text-xs">
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
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
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
