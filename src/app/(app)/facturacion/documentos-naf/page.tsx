"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Download, FileText, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import {
  labelEstado,
  labelEstadoTributacion,
  labelTipoDoc,
  NAF_TIPO_DOC_LABELS,
} from "@/modules/naf-documentos/business/document-labels";
import type { NafDocumentosListResult } from "@/modules/naf-documentos/services/list-naf-documents";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/components/ui/toaster";

function buildPdfUrl(row: {
  noCia: string;
  tipoDoc: string;
  noFactu: string;
  companyCode: string | null;
  claveFactura: string | null;
  consecutivoFe: string | null;
}) {
  const params = new URLSearchParams({
    noCia: row.noCia,
    tipoDoc: row.tipoDoc,
    noFactu: row.noFactu,
  });
  if (row.companyCode) params.set("companyCode", row.companyCode);
  if (row.claveFactura) params.set("claveFactura", row.claveFactura);
  if (row.consecutivoFe) params.set("consecutivoFe", row.consecutivoFe);
  return `/api/facturacion/documentos-naf/pdf?${params}`;
}

function canTryPdf(row: { claveFactura: string | null; consecutivoFe: string | null }) {
  return Boolean(row.claveFactura?.trim() || row.consecutivoFe?.trim());
}

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoFirstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Número consecutivo corto (últimos dígitos sin ceros a la izquierda) para lectura rápida. */
function shortConsecutivoFe(consecutivo: string | null | undefined): string | null {
  const raw = (consecutivo ?? "").trim();
  if (!raw) return null;
  // Consecutivo Hacienda 20 dígitos: tipo(2)+sucursal(3)+terminal(5)+tipoDoc(2)+numero(10)
  if (/^\d{20}$/.test(raw)) {
    const num = raw.slice(10).replace(/^0+/, "") || "0";
    return num;
  }
  const trimmed = raw.replace(/^0+/, "");
  return trimmed || raw;
}

const COMPANIES = [
  { code: "ALL", label: "Todas las compañías" },
  { code: "ACE", label: "ACE" },
  { code: "ALFA", label: "Alfa" },
  { code: "ALFATRONIC", label: "Alfatronic" },
  { code: "BENA", label: "Bena" },
  { code: "BENLO", label: "Benlo" },
  { code: "CONSORCIO", label: "Consorcio" },
  { code: "DESARROLLOS", label: "Desarrollos Constructivos" },
  { code: "JOBEN", label: "Joben" },
  { code: "MONITOREO", label: "Monitoreo" },
  { code: "TANGO", label: "Tango" },
];

const REFETCH_MS = 30_000;
const COLSPAN = 12;

export default function DocumentosNafPage() {
  const [dateFrom, setDateFrom] = useState(isoFirstOfMonth);
  const [dateTo, setDateTo] = useState(isoToday);
  const [company, setCompany] = useState("ALL");
  const [tipoDoc, setTipoDoc] = useState("ALL");
  const [search, setSearch] = useState("");
  const [ligadoFilter, setLigadoFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const queryKey = ["facturacion-documentos-naf", dateFrom, dateTo, company, tipoDoc, search, ligadoFilter, page];

  const { data, isLoading, isFetching, isError, error, refetch, dataUpdatedAt } = useQuery<{
    data: NafDocumentosListResult;
  }>({
    queryKey,
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_MS,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (company !== "ALL") params.set("company", company);
      if (tipoDoc !== "ALL") params.set("tipoDoc", tipoDoc);
      if (search.trim()) params.set("search", search.trim());
      if (ligadoFilter !== "ALL") params.set("ligadoFilter", ligadoFilter);
      const r = await fetch(`/api/facturacion/documentos-naf?${params}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar documentos NAF");
      return json;
    },
  });

  const result = data?.data;
  const rows = result?.rows ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeLabel = useMemo(() => `${formatDate(dateFrom)} – ${formatDate(dateTo)}`, [dateFrom, dateTo]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Documentos NAF</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Facturas y documentos electrónicos emitidos en NAF (Oracle{" "}
            <code className="text-xs bg-slate-100 px-1 rounded">NAF5.ARFAFE</code>
            ). Filtre por rango de fechas; se actualiza automáticamente cada 30 segundos.
          </p>
        </div>
        <div className="text-xs text-slate-500 text-right">
          <p>Última consulta: {dataUpdatedAt ? formatDateTime(new Date(dataUpdatedAt)) : "—"}</p>
          {(isFetching || isLoading) && (
            <p className="flex items-center justify-end gap-1 text-red-600 mt-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Actualizando…
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <CalendarDays className="h-5 w-5 text-slate-400" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Desde</span>
              <CalendarDateInput
                value={dateFrom}
                onChange={(v) => {
                  setDateFrom(v);
                  setPage(1);
                }}
                showPicker
                className="w-[140px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Hasta</span>
              <CalendarDateInput
                value={dateTo}
                onChange={(v) => {
                  setDateTo(v);
                  setPage(1);
                }}
                showPicker
                className="w-[140px]"
              />
            </div>
            <Select
              value={company}
              onValueChange={(v) => {
                setCompany(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Compañía" />
              </SelectTrigger>
              <SelectContent>
                {COMPANIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={tipoDoc}
              onValueChange={(v) => {
                setTipoDoc(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                {Object.entries(NAF_TIPO_DOC_LABELS).map(([code, label]) => (
                  <SelectItem key={code} value={code}>
                    {label} ({code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={ligadoFilter}
              onValueChange={(v) => {
                setLigadoFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Ligado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos (ligado)</SelectItem>
                <SelectItem value="LIGADOS">Solo ligados</SelectItem>
                <SelectItem value="NO_LIGADOS">Solo no ligados</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Consecutivo FE, clave, cliente, contrato…"
                className="pl-9 h-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Actualizar">
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>

          {result && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Documentos</p>
                <p className="font-semibold text-slate-800">{result.summary.count}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Subtotal</p>
                <p className="font-semibold">{formatCurrency(result.summary.subtotal)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">IVA</p>
                <p className="font-semibold">{formatCurrency(result.summary.impuesto)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Total</p>
                <p className="font-semibold text-blue-700">{formatCurrency(result.summary.total)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400">Consultando NAF…</div>
          ) : isError ? (
            <div className="p-12 text-center text-red-600">
              {(error as Error)?.message ?? "Error al cargar documentos NAF."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-table-id="facturacion-documentos-naf">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                      <th data-col-key="fecha" className="px-4 py-3 font-medium" style={{ width: 100 }}>Fecha</th>
                      <th data-col-key="compania" className="px-4 py-3 font-medium" style={{ width: 140 }}>Compañía</th>
                      <th data-col-key="tipo" className="px-4 py-3 font-medium" style={{ width: 70 }}>Tipo</th>
                      <th data-col-key="noFactu" className="px-4 py-3 font-medium" style={{ width: 120 }}>Nº Codisa (NO_FACTU)</th>
                      <th data-col-key="consecutivoFe" className="px-4 py-3 font-medium" style={{ width: 160 }}>Nº documento FE</th>
                      <th data-col-key="cliente" className="px-4 py-3 font-medium" style={{ width: 180 }}>Cliente</th>
                      <th data-col-key="contrato" className="px-4 py-3 font-medium" style={{ width: 160 }}>Contrato / licitación</th>
                      <th data-col-key="total" className="px-4 py-3 font-medium text-right" style={{ width: 110 }}>Total</th>
                      <th data-col-key="claveFe" className="px-4 py-3 font-medium" style={{ width: 180 }}>Clave FE</th>
                      <th data-col-key="estado" className="px-4 py-3 font-medium" style={{ width: 100 }}>Estado</th>
                      <th data-col-key="ligado" className="px-4 py-3 font-medium" style={{ width: 100 }}>Ligado</th>
                      <th data-col-key="pdf" className="px-4 py-3 font-medium text-center" style={{ width: 70 }}>PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={COLSPAN} className="p-12 text-center text-slate-400">
                          No hay documentos para {rangeLabel}.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const shortFe = shortConsecutivoFe(row.consecutivoFe);
                        return (
                        <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.fecha)}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">
                              {row.companyCode ?? row.noCia}
                            </div>
                            {row.companyName && (
                              <div className="text-xs text-slate-400">{row.companyName}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{labelTipoDoc(row.tipoDoc)}</Badge>
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {row.noFactu}
                            {row.noFisico && row.noFisico !== row.noFactu ? (
                              <div className="text-xs text-slate-400">Físico: {row.noFisico}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            {row.consecutivoFe ? (
                              <div>
                                <div
                                  className="font-semibold tabular-nums text-slate-800"
                                  title={row.consecutivoFe}
                                >
                                  {shortFe}
                                </div>
                                <div
                                  className="font-mono text-[10px] text-slate-400 whitespace-nowrap"
                                  title={row.consecutivoFe}
                                >
                                  {row.consecutivoFe}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-none">
                            <div className="whitespace-nowrap" title={row.cliente}>
                              {row.cliente}
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-none">
                            <div className="truncate text-xs text-slate-600" title={row.contrato ?? ""}>
                              {row.contrato ?? "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {formatCurrency(row.total)}
                          </td>
                          <td className="px-4 py-3">
                            {row.claveFactura ? (
                              <span
                                className="font-mono text-xs text-slate-600 whitespace-nowrap"
                                title={row.claveFactura}
                              >
                                {row.claveFactura}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <Badge variant="secondary">{labelEstado(row.estado)}</Badge>
                              {row.estadoTributacion && (
                                <p className="text-xs text-slate-500">
                                  {labelEstadoTributacion(row.estadoTributacion)}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {row.ligadoAFacturacion ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Sí</Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-500">No</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {canTryPdf(row) ? (
                              <div className="flex flex-col items-center gap-1">
                                <Button
                                  variant={row.pdfDisponible ? "default" : "outline"}
                                  size="sm"
                                  className="h-8 gap-1.5"
                                  title={
                                    row.pdfDisponible
                                      ? "Descargar PDF"
                                      : "Buscar y descargar PDF"
                                  }
                                  onClick={() => {
                                    fetch(buildPdfUrl(row))
                                      .then(async (r) => {
                                        if (!r.ok) {
                                          const json = await r.json().catch(() => null);
                                          throw new Error(
                                            json?.error?.message ??
                                              "No se encontró el PDF del documento",
                                          );
                                        }
                                        const blob = await r.blob();
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url;
                                        const disposition = r.headers.get("Content-Disposition");
                                        const match = disposition?.match(/filename=\"?([^\";]+)/);
                                        a.download = match?.[1]
                                          ? decodeURIComponent(match[1])
                                          : "documento.pdf";
                                        a.click();
                                        URL.revokeObjectURL(url);
                                      })
                                      .catch((err) => {
                                        toast.error(
                                          "PDF no disponible",
                                          err instanceof Error
                                            ? err.message
                                            : "No se encontró el archivo PDF",
                                        );
                                      });
                                  }}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  PDF
                                </Button>
                                {row.pdfDisponible ? (
                                  <span className="text-[10px] text-emerald-600">Disponible</span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Buscar</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300" title="Sin clave ni consecutivo FE">
                                <FileText className="h-4 w-4 mx-auto opacity-40" />
                              </span>
                            )}
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm">
                <p className="text-slate-500">
                  Página {page} de {totalPages} · {total} documento{total === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
