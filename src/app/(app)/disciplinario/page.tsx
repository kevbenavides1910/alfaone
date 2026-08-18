"use client";

import Link from "next/link";
import { useMemo, useState, useCallback } from "react";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, FileSpreadsheet, BarChart3, Upload, AlertTriangle, FileText, Eye, Users, Download, Plus, Trash2, Repeat, PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth/client-session";
import {
  canEditDisciplinaryHistorialSession,
  canImportDisciplinarySession,
} from "@/modules/core/permissions";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { formatDate } from "@/lib/utils/format";
import { ApercibimientoStatusDialog } from "@/components/disciplinary/StatusDialog";
import { CambiarResponsableDialog } from "@/components/disciplinary/CambiarResponsableDialog";
import { ContractClientDialog } from "@/components/disciplinary/ContractClientDialog";
import { ManualApercibimientoDialog } from "@/components/disciplinary/ManualApercibimientoDialog";
import { FirmaApercibimientoDialog } from "@/components/disciplinary/FirmaApercibimientoDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { Pencil } from "lucide-react";

const ESTADO_LABEL: Record<string, string> = {
  EMITIDO: "Emitido",
  ENTREGADO: "Entregado",
  FIRMADO: "Firmado",
  ANULADO: "Anulado",
};
const ESTADO_COLOR: Record<string, string> = {
  EMITIDO: "bg-slate-100 text-slate-700",
  ENTREGADO: "bg-amber-100 text-amber-800",
  FIRMADO: "bg-emerald-100 text-emerald-800",
  ANULADO: "bg-rose-100 text-rose-700",
};

const VIGENCIA_LABEL: Record<string, string> = {
  VIGENTE: "Vigente",
  VENCIDO: "Vencido",
  PRESCRITO: "Prescrito",
  FINALIZADO: "Finalizado",
  ANULADO: "Anulado",
};
const VIGENCIA_COLOR: Record<string, string> = {
  VIGENTE: "bg-green-100 text-green-700",
  VENCIDO: "bg-amber-100 text-amber-800",
  PRESCRITO: "bg-slate-200 text-slate-700",
  FINALIZADO: "bg-emerald-100 text-emerald-800",
  ANULADO: "bg-rose-100 text-rose-700",
};

interface ApercibimientoRow {
  id: string;
  numero: string;
  fechaEmision: string;
  codigoEmpleado: string;
  nombreEmpleado: string;
  zona: string | null;
  sucursal: string | null;
  cantidadOmisiones: number;
  administrador: string | null;
  estado: keyof typeof ESTADO_LABEL;
  vigencia: keyof typeof VIGENCIA_LABEL;
  plantilla: string | null;
  motivoAnulacion: string | null;
  contrato: string | null;
  cliente: string | null;
  clienteSetManual: boolean;
  pdfDisponible: boolean;
  evidenciaDisponible: boolean;
  firmado?: boolean;
  firmaRecibidoAt?: string | null;
  omisiones?: { id: string; fecha: string; hora: string | null }[];
}

export default function DisciplinarioListPage() {
  const { data: session } = useSession();
  const canManage = canEditDisciplinaryHistorialSession(session ?? null);
  const canImport = canImportDisciplinarySession(session ?? null);
  const queryClient = useQueryClient();

  const [statusDialog, setStatusDialog] = useState<{
    id: string;
    numero: string;
    estado: string;
    motivoAnulacion: string | null;
  } | null>(null);

  const [contractDialog, setContractDialog] = useState<{
    id: string;
    numero: string;
    contrato: string | null;
    cliente: string | null;
    clienteSetManual: boolean;
  } | null>(null);

  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; numero: string } | null>(null);
  const [responsableTarget, setResponsableTarget] = useState<{
    id: string;
    numero: string;
    codigoEmpleado: string;
    nombreEmpleado: string;
  } | null>(null);

  const [firmaTarget, setFirmaTarget] = useState<{
    id: string;
    numero: string;
    nombreEmpleado: string;
    firmado?: boolean;
  } | null>(null);

  const [filters, setFilters] = useState({
    desde: "",
    hasta: "",
    zona: "",
    sucursal: "",
    administrador: "",
    estado: "",
    vigencia: "",
    codigo: "",
    nombre: "",
    numero: "",
    contrato: "",
    cliente: "",
  });
  const [page, setPage] = useState(1);
  const limit = 100;

  const queryParams = useMemo(() => {
    const sp = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v.trim()) sp.set(k, v.trim());
    });
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    return sp.toString();
  }, [filters, page]);

  const { data, isLoading } = useQuery<{
    data: ApercibimientoRow[];
    meta: { total: number; page: number; limit: number };
  }>({
    queryKey: ["disciplinary-list", queryParams],
    queryFn: () => fetch(`/api/disciplinary/apercibimientos?${queryParams}`).then((r) => r.json()),
  });

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const onColumnFilterChange = useCallback((key: string, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const historialColumnDefs = useMemo((): TableColumnFilterDef<ApercibimientoRow>[] => {
    const estadoOptions = Object.entries(ESTADO_LABEL).map(([, label]) => ({
      value: label,
      label,
    }));
    const vigenciaOptions = Object.entries(VIGENCIA_LABEL).map(([, label]) => ({
      value: label,
      label,
    }));
    return [
      { key: "numero", label: "N°", getValue: (r) => r.numero },
      { key: "fecha", label: "Fecha", getValue: (r) => formatDate(r.fechaEmision) },
      { key: "codigo", label: "Código", getValue: (r) => r.codigoEmpleado },
      { key: "nombre", label: "Empleado", getValue: (r) => r.nombreEmpleado },
      {
        key: "zona",
        label: "Zona / Sucursal",
        getValue: (r) => [r.zona, r.sucursal].filter(Boolean).join(" / "),
      },
      { key: "omisiones", label: "Omisiones", align: "center", getValue: (r) => String(r.cantidadOmisiones) },
      { key: "administrador", label: "Administrador", getValue: (r) => r.administrador ?? "" },
      {
        key: "estado",
        label: "Estado",
        getValue: (r) => ESTADO_LABEL[r.estado] ?? r.estado,
        options: estadoOptions,
        mode: "select",
      },
      {
        key: "vigencia",
        label: "Vigencia",
        getValue: (r) => VIGENCIA_LABEL[r.vigencia] ?? r.vigencia,
        options: vigenciaOptions,
        mode: "select",
      },
      { key: "contrato", label: "Contrato", getValue: (r) => r.contrato ?? "" },
      { key: "cliente", label: "Cliente", getValue: (r) => r.cliente ?? "" },
      { key: "adjuntos", label: "Adjuntos", align: "center", filterable: false, getValue: () => "" },
      { key: "actions", label: "", filterable: false, getValue: () => "" },
    ];
  }, []);

  const [localColumnFilters, setLocalColumnFilters] = useState<Record<string, string>>({});
  const onLocalColumnFilterChange = useCallback((key: string, value: string) => {
    setLocalColumnFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const displayedRows = useMemo(() => {
    const serverKeys = new Set([
      "numero",
      "codigo",
      "nombre",
      "zona",
      "administrador",
      "estado",
      "vigencia",
      "contrato",
      "cliente",
    ]);
    const localOnly = historialColumnDefs.filter(
      (c) => c.filterable !== false && !serverKeys.has(c.key)
    );
    if (localOnly.length === 0) return rows;
    return filterRowsByColumnFilters(
      rows,
      localColumnFilters,
      localOnly.map((col) => ({
        key: col.key,
        getValue: col.getValue,
        mode: col.mode,
        filterable: col.filterable,
      }))
    );
  }, [rows, localColumnFilters, historialColumnDefs]);

  const mergedColumnFilters = useMemo(
    () => ({
      numero: filters.numero,
      fecha: localColumnFilters.fecha ?? "",
      codigo: filters.codigo,
      nombre: filters.nombre,
      zona: filters.zona,
      omisiones: localColumnFilters.omisiones ?? "",
      administrador: filters.administrador,
      estado: filters.estado ? (ESTADO_LABEL[filters.estado as keyof typeof ESTADO_LABEL] ?? filters.estado) : "",
      vigencia: filters.vigencia ? (VIGENCIA_LABEL[filters.vigencia as keyof typeof VIGENCIA_LABEL] ?? filters.vigencia) : "",
      contrato: filters.contrato,
      cliente: filters.cliente,
    }),
    [filters, localColumnFilters]
  );

  const onHistorialColumnFilterChange = useCallback(
    (key: string, value: string) => {
      if (key === "fecha" || key === "omisiones") {
        onLocalColumnFilterChange(key, value);
        return;
      }
      if (key === "estado") {
        const code =
          Object.entries(ESTADO_LABEL).find(([, label]) => label === value)?.[0] ?? value;
        onColumnFilterChange("estado", value ? code : "");
        return;
      }
      if (key === "vigencia") {
        const code =
          Object.entries(VIGENCIA_LABEL).find(([, label]) => label === value)?.[0] ?? value;
        onColumnFilterChange("vigencia", value ? code : "");
        return;
      }
      if (key === "zona") {
        onColumnFilterChange("zona", value);
        return;
      }
      onColumnFilterChange(key, value);
    },
    [onColumnFilterChange, onLocalColumnFilterChange]
  );

  const historialFilterKeys = useMemo(
    () => historialColumnDefs.filter((c) => c.filterable !== false).map((c) => c.key),
    [historialColumnDefs]
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/disciplinary/apercibimientos/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al eliminar");
      return json.data as { numero?: string };
    },
    onSuccess: () => {
      toast.success("Apercibimiento eliminado");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["disciplinary-list"] });
      queryClient.invalidateQueries({ queryKey: ["disciplinary-resumen"] });
      queryClient.invalidateQueries({ queryKey: ["disciplinary-detail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quickStatusMutation = useMutation({
    mutationFn: async (vars: { id: string; estado: string }) => {
      const res = await fetch(`/api/disciplinary/apercibimientos/${vars.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: vars.estado, motivoAnulacion: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cambiar estado");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["disciplinary-list"] });
      queryClient.invalidateQueries({ queryKey: ["disciplinary-resumen"] });
      queryClient.invalidateQueries({ queryKey: ["disciplinary-detail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleQuickStatusChange(row: ApercibimientoRow, nextEstado: string) {
    if (nextEstado === row.estado) return;
    if (nextEstado === "ANULADO") {
      // ANULADO requiere motivo: abrimos el diálogo en lugar de mutar directo.
      setStatusDialog({
        id: row.id,
        numero: row.numero,
        estado: row.estado,
        motivoAnulacion: row.motivoAnulacion,
      });
      return;
    }
    quickStatusMutation.mutate({ id: row.id, estado: nextEstado });
  }

  function clearFilters() {
    setFilters({
      desde: "",
      hasta: "",
      zona: "",
      sucursal: "",
      administrador: "",
      estado: "",
      vigencia: "",
      codigo: "",
      nombre: "",
      numero: "",
      contrato: "",
      cliente: "",
    });
    setPage(1);
  }

  function handleExport() {
    if (displayedRows.length === 0) return;
    const exportRows = displayedRows.map((r) => ({
      "N° Apercibimiento": r.numero,
      "Fecha Emisión": formatDate(r.fechaEmision),
      Código: r.codigoEmpleado,
      Nombre: r.nombreEmpleado,
      Zona: r.zona ?? "",
      Sucursal: r.sucursal ?? "",
      Omisiones: r.cantidadOmisiones,
      "Fechas de omisión": (r.omisiones ?? [])
        .map((o) => (o.hora ? `${formatDate(o.fecha)} ${o.hora}` : formatDate(o.fecha)))
        .join(", "),
      Administrador: r.administrador ?? "",
      Estado: ESTADO_LABEL[r.estado] ?? r.estado,
      Vigencia: VIGENCIA_LABEL[r.vigencia] ?? r.vigencia,
      Contrato: r.contrato ?? "",
      Cliente: r.cliente ?? "",
      Plantilla: r.plantilla ?? "",
      "PDF disponible": r.pdfDisponible ? "Sí" : "No",
      "Evidencia disponible": r.evidenciaDisponible ? "Sí" : "No",
    }));
    exportRowsToExcel({
      filename: "apercibimientos",
      sheetName: "Apercibimientos",
      rows: exportRows,
      columnWidths: [22, 14, 14, 28, 18, 18, 12, 40, 22, 14, 14, 22, 28, 14, 16, 18],
    });
  }

  return (
    <>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              Apercibimientos
            </h1>
            <p className="text-sm text-slate-500">
              Registro central de apercibimientos (importación, escritorio o alta manual).{" "}
              {canManage
                ? "Los administradores y supervisores pueden dar de alta o eliminar registros manuales."
                : "Consulta y seguimiento de estado."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/disciplinario/empleados">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm">
                <Users className="h-4 w-4 shrink-0" /> <span className="hidden xs:inline">Resumen</span>
              </Button>
            </Link>
            <Link href="/disciplinario/reportes/omisiones">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" /> <span className="hidden xs:inline">Omisiones</span>
              </Button>
            </Link>
            <Link href="/disciplinario/dashboard">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm">
                <BarChart3 className="h-4 w-4 shrink-0" /> <span className="hidden xs:inline">Dashboard</span>
              </Button>
            </Link>
            {canManage && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs sm:text-sm" onClick={() => setManualDialogOpen(true)}>
                  <Plus className="h-4 w-4 shrink-0" /> <span>Alta</span>
                </Button>
                {canImport && (
                  <Link href="/disciplinario/importar">
                    <Button size="sm" className="gap-1.5 text-xs sm:text-sm">
                      <Upload className="h-4 w-4 shrink-0" /> <span>Importar</span>
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Desde</label>
                <Input
                  type="date"
                  value={filters.desde}
                  onChange={(e) => { setFilters({ ...filters, desde: e.target.value }); setPage(1); }}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Hasta</label>
                <Input
                  type="date"
                  value={filters.hasta}
                  onChange={(e) => { setFilters({ ...filters, hasta: e.target.value }); setPage(1); }}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Estado</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={filters.estado}
                  onChange={(e) => { setFilters({ ...filters, estado: e.target.value }); setPage(1); }}
                >
                  <option value="">Todos</option>
                  {Object.entries(ESTADO_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Vigencia</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={filters.vigencia}
                  onChange={(e) => { setFilters({ ...filters, vigencia: e.target.value }); setPage(1); }}
                >
                  <option value="">Todas</option>
                  {Object.entries(VIGENCIA_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Administrador</label>
                <Input
                  value={filters.administrador}
                  onChange={(e) => { setFilters({ ...filters, administrador: e.target.value }); setPage(1); }}
                  placeholder="Contiene…"
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Zona</label>
                <Input
                  value={filters.zona}
                  onChange={(e) => { setFilters({ ...filters, zona: e.target.value }); setPage(1); }}
                  placeholder="Contiene…"
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Sucursal</label>
                <Input
                  value={filters.sucursal}
                  onChange={(e) => { setFilters({ ...filters, sucursal: e.target.value }); setPage(1); }}
                  placeholder="Contiene…"
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Código empleado</label>
                <Input
                  value={filters.codigo}
                  onChange={(e) => { setFilters({ ...filters, codigo: e.target.value }); setPage(1); }}
                  placeholder="Exacto"
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Nombre</label>
                <Input
                  value={filters.nombre}
                  onChange={(e) => { setFilters({ ...filters, nombre: e.target.value }); setPage(1); }}
                  placeholder="Contiene…"
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">N° Apercibimiento</label>
                <Input
                  value={filters.numero}
                  onChange={(e) => { setFilters({ ...filters, numero: e.target.value }); setPage(1); }}
                  placeholder="Contiene…"
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Contrato (Licitación)</label>
                <Input
                  value={filters.contrato}
                  onChange={(e) => { setFilters({ ...filters, contrato: e.target.value }); setPage(1); }}
                  placeholder="Contiene…"
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Cliente</label>
                <Input
                  value={filters.cliente}
                  onChange={(e) => { setFilters({ ...filters, cliente: e.target.value }); setPage(1); }}
                  placeholder="Contiene…"
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" size="sm" className="h-9 text-slate-500" onClick={clearFilters}>
                Limpiar filtros
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-2"
                disabled={displayedRows.length === 0}
                onClick={handleExport}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar a Excel ({displayedRows.length})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-10 text-center text-slate-400">Cargando…</div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <Search className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                No hay apercibimientos con esos filtros.
              </div>
            ) : (
              <div className="overflow-x-auto">
              {hasActiveColumnFilters({ ...mergedColumnFilters, ...localColumnFilters }) && (
                <div className="flex justify-end px-3 py-1.5 border-b bg-slate-50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setLocalColumnFilters(clearColumnFilters(["fecha", "omisiones"]));
                      setFilters((prev) => ({
                        ...prev,
                        numero: "",
                        codigo: "",
                        nombre: "",
                        zona: "",
                        administrador: "",
                        estado: "",
                        vigencia: "",
                        contrato: "",
                        cliente: "",
                      }));
                      setPage(1);
                    }}
                  >
                    Limpiar filtros de columnas
                  </Button>
                </div>
              )}
              <table data-table-id="disciplinario-historial" className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <TableColumnFilterHead
                    tableId="disciplinario-historial"
                    defaultColumnWidths={{
                      numero: 100,
                      fecha: 110,
                      codigo: 120,
                      nombre: 180,
                      zona: 120,
                      omisiones: 100,
                      administrador: 160,
                      estado: 100,
                      vigencia: 110,
                      contrato: 140,
                      cliente: 180,
                      adjuntos: 90,
                      actions: 90,
                    }}
                    columns={historialColumnDefs}
                    rows={rows}
                    filters={mergedColumnFilters}
                    onFilterChange={onHistorialColumnFilterChange}
                    headerRowClassName="text-left"
                    filterRowClassName="bg-slate-50/80 border-b border-slate-200"
                  />
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.numero}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(r.fechaEmision)}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{r.codigoEmpleado}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/disciplinario/empleados/${encodeURIComponent(r.codigoEmpleado)}`}
                          className="font-medium text-slate-800 hover:text-red-600 hover:underline"
                        >
                          {r.nombreEmpleado}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {[r.zona, r.sucursal].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="font-medium">{r.cantidadOmisiones}</div>
                        {r.omisiones && r.omisiones.length > 0 && (
                          <div className="mt-1 flex flex-wrap justify-center gap-1">
                            {r.omisiones.map((o) => (
                              <span
                                key={o.id}
                                className="inline-block rounded bg-amber-50 text-amber-800 px-1.5 py-0.5 text-[10px]"
                                title={o.hora ? `Omisión ${formatDate(o.fecha)} ${o.hora}` : "Fecha de omisión"}
                              >
                                {formatDate(o.fecha)}
                                {o.hora && (
                                  <span className="ml-1 font-medium text-amber-900">
                                    {o.hora}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.administrador ?? "—"}</td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <select
                            className={`h-7 rounded-md border border-input px-2 text-xs font-medium ${ESTADO_COLOR[r.estado] ?? "bg-card"}`}
                            value={r.estado}
                            disabled={quickStatusMutation.isPending}
                            onChange={(e) => handleQuickStatusChange(r, e.target.value)}
                            title="Cambiar estado"
                          >
                            {Object.entries(ESTADO_LABEL).map(([k, v]) => (
                              <option key={k} value={k} className="bg-card text-slate-800">
                                {v}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge className={`${ESTADO_COLOR[r.estado] ?? ""} border-0 text-xs font-medium`}>
                            {ESTADO_LABEL[r.estado] ?? r.estado}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${VIGENCIA_COLOR[r.vigencia] ?? ""} border-0 text-xs font-medium`}>
                          {VIGENCIA_LABEL[r.vigencia] ?? r.vigencia}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-700">
                        {r.contrato || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {r.cliente ? (
                          <span title={r.clienteSetManual ? "Cliente editado manualmente" : undefined}>
                            {r.cliente}
                            {r.clienteSetManual && <span className="ml-1 text-amber-600">●</span>}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        <div className="flex justify-center gap-1 flex-wrap">
                          <a
                            href={`/api/disciplinary/apercibimientos/${r.id}/pdf`}
                            className="inline-flex text-slate-400 hover:text-red-600 transition-colors"
                            title="Descargar PDF de omisión / apercibimiento"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                          {r.pdfDisponible && (
                            <span title="PDF de archivo interno (app escritorio)" className="text-slate-400">
                              <FileText className="h-3.5 w-3.5" />
                            </span>
                          )}
                          {r.evidenciaDisponible && (
                            <span title="Evidencia de anulación disponible" className="text-slate-400">
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {canManage && r.estado !== "ANULADO" && (
                              <button
                                type="button"
                                onClick={() =>
                                  setFirmaTarget({
                                    id: r.id,
                                    numero: r.numero,
                                    nombreEmpleado: r.nombreEmpleado,
                                    firmado: r.firmado,
                                  })
                                }
                                className="inline-flex items-center text-slate-500 hover:text-emerald-700 text-xs gap-1"
                                title={r.firmado ? "Volver a firmar y reenviar PDF" : "Firmar y enviar PDF firmado"}
                              >
                                <PenLine className="h-3.5 w-3.5" /> {r.firmado ? "Re-firmar" : "Firmar"}
                              </button>
                            )}
                          {canManage && (
                            <>
                              <button
                                onClick={() =>
                                  setResponsableTarget({
                                    id: r.id,
                                    numero: r.numero,
                                    codigoEmpleado: r.codigoEmpleado,
                                    nombreEmpleado: r.nombreEmpleado,
                                  })
                                }
                                className="inline-flex items-center text-slate-500 hover:text-amber-700 text-xs gap-1"
                                title="Reasignar apercibimiento a otro empleado"
                              >
                                <Repeat className="h-3.5 w-3.5" /> Reasignar
                              </button>
                              <button
                                onClick={() =>
                                  setContractDialog({
                                    id: r.id,
                                    numero: r.numero,
                                    contrato: r.contrato,
                                    cliente: r.cliente,
                                    clienteSetManual: r.clienteSetManual,
                                  })
                                }
                                className="inline-flex items-center text-slate-500 hover:text-red-600 text-xs gap-1"
                                title="Editar contrato/cliente"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Contrato
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ id: r.id, numero: r.numero })}
                                className="inline-flex items-center text-slate-500 hover:text-rose-600 text-xs gap-1"
                                title="Eliminar apercibimiento"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Eliminar
                              </button>
                            </>
                          )}
                          <Link
                            href={`/disciplinario/empleados/${encodeURIComponent(r.codigoEmpleado)}`}
                            className="inline-flex items-center text-red-600 hover:underline text-xs gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </CardContent>
        </Card>

        <CambiarResponsableDialog
          open={!!responsableTarget}
          onOpenChange={(o) => !o && setResponsableTarget(null)}
          apercibimiento={responsableTarget}
        />

        {/* Diálogo de motivo cuando se selecciona ANULADO desde el listado */}
        <ApercibimientoStatusDialog
          open={!!statusDialog}
          onOpenChange={(o) => !o && setStatusDialog(null)}
          apercibimiento={statusDialog}
        />

        {/* Diálogo para editar contrato/cliente */}
        <ContractClientDialog
          open={!!contractDialog}
          onOpenChange={(o) => !o && setContractDialog(null)}
          apercibimiento={contractDialog}
        />

        <ManualApercibimientoDialog open={manualDialogOpen} onOpenChange={setManualDialogOpen} />

        <FirmaApercibimientoDialog
          open={!!firmaTarget}
          onOpenChange={(o) => !o && setFirmaTarget(null)}
          apercibimiento={firmaTarget}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["disciplinary-list"] })}
        />

        <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar apercibimiento</DialogTitle>
              <DialogDescription>
                Se eliminará <strong>{deleteTarget?.numero}</strong> y todas sus omisiones en base de datos.
                Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              >
                {deleteMutation.isPending ? "Eliminando…" : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Paginación */}
        {total > limit && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              Mostrando {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-xs">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
