"use client";

import { Fragment, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import {
  labelCxpEstado,
  labelFaeAceptacion,
  type CxpEstadoPago,
} from "@/modules/cuentas-por-pagar/business/cxp-status";
import type { CxpFacturaRow, CxpFacturasListResult } from "@/modules/cuentas-por-pagar/services/list-cxp-facturas";
import type { CxpAmarreRow, CxpAmarresResult } from "@/modules/cuentas-por-pagar/services/get-cxp-factura-amarres";
import type { CxpProveedoresListResult } from "@/modules/cuentas-por-pagar/services/list-cxp-proveedores";

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

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

const TIPOS_DOC = [
  { code: "ALL", label: "Todos los tipos" },
  { code: "FA", label: "Facturación local (FA)" },
  { code: "FS", label: "Facturas de servicios (FS)" },
  { code: "FH", label: "Facturas de honorarios (FH)" },
  { code: "FP", label: "Factura psicológicos (FP)" },
  { code: "FD", label: "Factura dictamen médico (FD)" },
];

const ESTADOS = [
  { code: "ALL", label: "Todos los estados" },
  { code: "PENDIENTE", label: "Pendiente pago" },
  { code: "PARCIAL", label: "Parcial" },
  { code: "PAGADA", label: "Pagada (amarrada)" },
  { code: "ANULADA", label: "Anulada" },
  { code: "SIN_CXP", label: "Sin CXP (solo FAE)" },
];

const FAE_LINKS = [
  { code: "ALL", label: "FAE: todas" },
  { code: "CON_FAE", label: "Con FAE" },
  { code: "SIN_FAE", label: "Sin FAE" },
  { code: "FAE_PENDIENTE", label: "FAE pendiente aceptación" },
];

const REFETCH_MS = 120_000;
const PAGE_SIZE = 50;
const COLSPAN = 15;

function currentYear() {
  return new Date().getFullYear();
}

function estadoBadge(estado: CxpEstadoPago) {
  const label = labelCxpEstado(estado);
  switch (estado) {
    case "PENDIENTE":
      return (
        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-transparent">
          {label}
        </Badge>
      );
    case "PARCIAL":
      return (
        <Badge className="bg-sky-100 text-sky-900 hover:bg-sky-100 border-transparent">
          {label}
        </Badge>
      );
    case "PAGADA":
      return (
        <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100 border-transparent">
          {label}
        </Badge>
      );
    case "ANULADA":
      return (
        <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 border-transparent">
          {label}
        </Badge>
      );
    case "SIN_CXP":
      return (
        <Badge className="bg-violet-100 text-violet-900 hover:bg-violet-100 border-transparent">
          {label}
        </Badge>
      );
  }
}

function faeAceptacionBadge(row: CxpFacturaRow) {
  if (!row.conFae) {
    return <span className="text-slate-400">—</span>;
  }
  const code = (row.faeAceptacion ?? "").trim().toUpperCase();
  const label = row.faeAceptacionLabel || labelFaeAceptacion(code);
  if (code === "P") {
    return (
      <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-transparent">
        {label}
      </Badge>
    );
  }
  if (code === "A" || code === "AA") {
    return (
      <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100 border-transparent">
        {label}
      </Badge>
    );
  }
  if (code === "R" || code === "X") {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-transparent">
        {label}
      </Badge>
    );
  }
  return <Badge variant="outline">{label}</Badge>;
}

function TraceabilityPanel({ row }: { row: CxpFacturaRow }) {
  const canLoadAmarres = row.origen === "CXP" && Boolean(row.tipoDoc && row.noDocu);
  const { data, isLoading, isError, error } = useQuery<{ data: CxpAmarresResult }>({
    queryKey: ["cxp-amarres", row.noCia, row.tipoDoc, row.noDocu, row.noProve],
    enabled: canLoadAmarres,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (row.noProve) params.set("noProve", row.noProve);
      const qs = params.toString();
      const url = `/api/cuentas-por-pagar/${encodeURIComponent(row.noCia)}/${encodeURIComponent(row.tipoDoc)}/${encodeURIComponent(row.noDocu)}/amarres${qs ? `?${qs}` : ""}`;
      const r = await fetch(url);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar amarres");
      return json;
    },
  });

  const amarres: CxpAmarreRow[] = data?.data?.rows ?? [];

  return (
    <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 space-y-4">
      <div>
        <p className="text-xs font-medium text-slate-600 mb-2">Trazabilidad FAE ↔ CXP</p>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 text-xs">
          <div className="rounded border border-slate-200 bg-white px-3 py-2">
            <p className="text-slate-500">Origen</p>
            <p className="font-medium text-slate-800">{row.origen === "FAE" ? "Solo FAE" : "CXP Codisa"}</p>
          </div>
          <div className="rounded border border-slate-200 bg-white px-3 py-2">
            <p className="text-slate-500">Consecutivo FE</p>
            <p className="font-medium tabular-nums break-all">{row.faeConsecutivo ?? "—"}</p>
          </div>
          <div className="rounded border border-slate-200 bg-white px-3 py-2">
            <p className="text-slate-500">Clave Hacienda</p>
            <p className="font-medium tabular-nums break-all">{row.faeClave ?? "—"}</p>
          </div>
          <div className="rounded border border-slate-200 bg-white px-3 py-2">
            <p className="text-slate-500">Fecha FE / Total FAE</p>
            <p className="font-medium">
              {row.faeFecha ? formatDate(row.faeFecha) : "—"}
              {" · "}
              {row.faeTotal != null ? formatCurrency(row.faeTotal) : "—"}
            </p>
          </div>
          <div className="rounded border border-slate-200 bg-white px-3 py-2">
            <p className="text-slate-500">Aceptación / Procesado</p>
            <p className="font-medium">
              {row.conFae ? row.faeAceptacionLabel : "Sin vínculo FAE"}
              {" · "}
              {row.faeProcesado == null ? "—" : row.faeProcesado ? "Procesado" : "No procesado"}
            </p>
          </div>
          <div className="rounded border border-slate-200 bg-white px-3 py-2">
            <p className="text-slate-500">Nº físico CXP ↔ FAE</p>
            <p className="font-medium tabular-nums">
              {row.noFisico ?? "—"}
              {row.faeConsecutivo ? ` ↔ …${row.faeConsecutivo.slice(-8)}` : ""}
            </p>
          </div>
        </div>
      </div>

      {canLoadAmarres ? (
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">
            Amarres / aplicaciones CXP ({isLoading ? "…" : amarres.length})
          </p>
          {isLoading ? (
            <div className="text-sm text-slate-500">Cargando amarres…</div>
          ) : isError ? (
            <div className="text-sm text-red-600">
              {(error as Error)?.message ?? "No se pudieron cargar los amarres."}
            </div>
          ) : amarres.length === 0 ? (
            <div className="text-sm text-slate-500">Sin aplicaciones de pago en NAF5.ARCPRD.</div>
          ) : (
            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-500">
                    <th className="px-3 py-2 font-medium">Fecha aplic.</th>
                    <th className="px-3 py-2 font-medium">Pago</th>
                    <th className="px-3 py-2 font-medium">Nº físico</th>
                    <th className="px-3 py-2 font-medium text-right">Monto aplicado</th>
                    <th className="px-3 py-2 font-medium text-right">Monto pago</th>
                    <th className="px-3 py-2 font-medium">Procesado</th>
                  </tr>
                </thead>
                <tbody>
                  {amarres.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {a.fechaAplicacion ? formatDate(a.fechaAplicacion) : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-medium">{a.pagoTipoDoc}</span> {a.pagoNoDocu}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{a.pagoNoFisico ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(a.montoAplicado)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {a.pagoMonto != null ? formatCurrency(a.pagoMonto) : "—"}
                      </td>
                      <td className="px-3 py-2">{a.procesado ? "Sí" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Documento solo en FAE: aún no hay digitación/amarrre en CXP Codisa.
        </p>
      )}
    </div>
  );
}

export function CxpFacturasPageClient() {
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [company, setCompany] = useState("ALL");
  const [tipoDoc, setTipoDoc] = useState("ALL");
  const [estado, setEstado] = useState("ALL");
  const [faeLink, setFaeLink] = useState("ALL");
  const [noProve, setNoProve] = useState("ALL");
  const [proveedorSearch, setProveedorSearch] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const yearOptions = useMemo(
    () => [currentYear() - 2, currentYear() - 1, currentYear(), currentYear() + 1],
    [],
  );

  const proveedoresQuery = useQuery<{ data: CxpProveedoresListResult }>({
    queryKey: ["cxp-proveedores", company, proveedorSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "80" });
      if (company !== "ALL") params.set("company", company);
      if (proveedorSearch.trim()) params.set("search", proveedorSearch.trim());
      const r = await fetch(`/api/cuentas-por-pagar/proveedores?${params}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar proveedores");
      return json;
    },
  });

  const proveedores = proveedoresQuery.data?.data?.rows ?? [];

  const queryKey = [
    "cuentas-por-pagar",
    periodMonth,
    periodYear,
    company,
    tipoDoc,
    estado,
    faeLink,
    noProve,
    search,
    page,
  ];

  const { data, isLoading, isFetching, isError, error, refetch, dataUpdatedAt } = useQuery<{
    data: CxpFacturasListResult;
  }>({
    queryKey,
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_MS,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        periodMonth: String(periodMonth),
        periodYear: String(periodYear),
        page: String(page),
        pageSize: String(PAGE_SIZE),
        estado,
        faeLink,
      });
      if (company !== "ALL") params.set("company", company);
      if (tipoDoc !== "ALL") params.set("tipoDoc", tipoDoc);
      if (noProve !== "ALL") params.set("noProve", noProve);
      if (search.trim()) params.set("search", search.trim());
      const r = await fetch(`/api/cuentas-por-pagar?${params}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar CXP");
      return json;
    },
  });

  const result = data?.data;
  const rows = result?.rows ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const monthLabel = MONTHS.find((m) => m.value === periodMonth)?.label ?? "";

  const columnDefs: TableColumnFilterDef<CxpFacturaRow>[] = useMemo(
    () => [
      {
        key: "expand",
        label: "",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-2 py-2",
        getValue: () => "",
        filterable: false,
      },
      {
        key: "fecha",
        label: "Fecha CXP",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => formatDate(r.fecha),
      },
      {
        key: "faeFecha",
        label: "Fecha FE",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => (r.faeFecha ? formatDate(r.faeFecha) : ""),
      },
      {
        key: "compania",
        label: "Compañía",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.companyCode ?? r.noCia,
      },
      {
        key: "proveedor",
        label: "Proveedor",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.proveedor,
      },
      {
        key: "tipo",
        label: "Tipo",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.tipoDoc,
      },
      {
        key: "noDocu",
        label: "Nº CXP",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => (r.origen === "CXP" ? r.noDocu : ""),
      },
      {
        key: "noFisico",
        label: "Nº físico",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.noFisico ?? "",
      },
      {
        key: "faeConsecutivo",
        label: "Consecutivo FE",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.faeConsecutivo ?? "",
      },
      {
        key: "monto",
        label: "Monto CXP",
        align: "right",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600 text-right",
        getValue: (r) => String(r.monto),
        filterable: false,
      },
      {
        key: "faeTotal",
        label: "Monto FAE",
        align: "right",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600 text-right",
        getValue: (r) => (r.faeTotal != null ? String(r.faeTotal) : ""),
        filterable: false,
      },
      {
        key: "saldo",
        label: "Saldo",
        align: "right",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600 text-right",
        getValue: (r) => String(r.saldo),
        filterable: false,
      },
      {
        key: "estado",
        label: "Estado CXP",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => labelCxpEstado(r.estado),
      },
      {
        key: "faeAceptacion",
        label: "Aceptación FAE",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.faeAceptacionLabel,
      },
      {
        key: "aplic",
        label: "Aplic.",
        align: "center",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600 text-center",
        getValue: (r) => String(r.nAplicaciones),
        filterable: false,
      },
    ],
    [],
  );

  const columnFilterKeys = columnDefs.map((c) => c.key);
  const displayedRows = useMemo(
    () => filterRowsByColumnFilters(rows, columnFilters, columnDefs),
    [rows, columnDefs, columnFilters],
  );

  function onColumnFilterChange(key: string, value: string) {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleExport() {
    exportRowsToExcel({
      filename: `cxp_fae_${periodYear}_${String(periodMonth).padStart(2, "0")}`,
      sheetName: "CXP-FAE",
      rows: displayedRows.map((r) => ({
        Origen: r.origen,
        "Fecha CXP": formatDate(r.fecha),
        "Fecha FE": r.faeFecha ? formatDate(r.faeFecha) : "",
        Compañía: r.companyCode ?? r.noCia,
        Proveedor: r.proveedor,
        Cédula: r.cedula ?? "",
        "Cód. proveedor": r.noProve,
        Tipo: r.tipoDoc,
        "Nº CXP": r.origen === "CXP" ? r.noDocu : "",
        "Nº físico": r.noFisico ?? "",
        "Consecutivo FE": r.faeConsecutivo ?? "",
        "Clave Hacienda": r.faeClave ?? "",
        Moneda: r.monedaLabel,
        "Monto CXP": r.monto,
        "Monto FAE": r.faeTotal ?? "",
        Saldo: r.saldo,
        "Monto aplicado": r.montoAplicado,
        Aplicaciones: r.nAplicaciones,
        "Estado CXP": labelCxpEstado(r.estado),
        "Aceptación FAE": r.faeAceptacionLabel,
        "Procesado FAE":
          r.faeProcesado == null ? "" : r.faeProcesado ? "Sí" : "No",
        "FH procesado FAE": r.faeFhProcesado ? formatDateTime(r.faeFhProcesado) : "",
        "Estado Hacienda": r.faeEstadoHacienda ?? "",
        Vence: r.fechaVence ? formatDate(r.fechaVence) : "",
        Detalle: r.detalle ?? "",
      })),
      columnWidths: [
        8, 12, 12, 12, 28, 14, 12, 8, 14, 12, 22, 28, 8, 14, 14, 14, 14, 10, 14, 18, 12, 16, 12, 12,
        30,
      ],
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Cuentas por pagar</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Facturas CXP Codisa (
            <code className="text-xs bg-slate-100 px-1 rounded">NAF5.ARCPMD</code>
            ) cruzadas con compras FE (
            <code className="text-xs bg-slate-100 px-1 rounded">FAE.FAE_COMPRAS_ENCABEZADOS</code>
            ) por cédula + nº físico ↔ consecutivo. Incluye FAE sin digitación en CXP.
          </p>
        </div>
        <div className="text-xs text-slate-500 text-right space-y-1">
          <p>Última consulta: {dataUpdatedAt ? formatDateTime(new Date(dataUpdatedAt)) : "—"}</p>
          {(isFetching || isLoading) && (
            <p className="flex items-center justify-end gap-1 text-red-600">
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
            <Select
              value={String(periodMonth)}
              onValueChange={(v) => {
                setPeriodMonth(parseInt(v, 10));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(periodYear)}
              onValueChange={(v) => {
                setPeriodYear(parseInt(v, 10));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={company}
              onValueChange={(v) => {
                setCompany(v);
                setNoProve("ALL");
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
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DOC.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={estado}
              onValueChange={(v) => {
                setEstado(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e.code} value={e.code}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={faeLink}
              onValueChange={(v) => {
                setFaeLink(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Vínculo FAE" />
              </SelectTrigger>
              <SelectContent>
                {FAE_LINKS.map((e) => (
                  <SelectItem key={e.code} value={e.code}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                value={proveedorSearch}
                onChange={(e) => setProveedorSearch(e.target.value)}
                placeholder="Filtrar lista proveedores…"
                className="h-9 w-[180px]"
              />
              <Select
                value={noProve}
                onValueChange={(v) => {
                  setNoProve(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los proveedores</SelectItem>
                  {proveedores.map((p) => (
                    <SelectItem key={`${p.noCia}-${p.noProve}`} value={p.noProve}>
                      {p.nombre} ({p.noProve})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Proveedor, cédula, CXP, físico, consecutivo o clave FE…"
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
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={displayedRows.length === 0}>
              <Download className="h-4 w-4" />
              Excel
            </Button>
          </div>

          {result && (
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Registros</p>
                <p className="font-semibold text-slate-800">{result.summary.count}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Monto</p>
                <p className="font-semibold">{formatCurrency(result.summary.monto)}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs text-amber-700">Pendientes pago</p>
                <p className="font-semibold text-amber-900">{result.summary.pendientes}</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-3">
                <p className="text-xs text-sky-700">Parciales</p>
                <p className="font-semibold text-sky-900">{result.summary.parciales}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Saldo CXP</p>
                <p className="font-semibold text-emerald-900">{formatCurrency(result.summary.saldo)}</p>
              </div>
              <div className="rounded-lg bg-violet-50 p-3">
                <p className="text-xs text-violet-700">Solo FAE</p>
                <p className="font-semibold text-violet-900">{result.summary.sinCxp}</p>
              </div>
              <div className="rounded-lg bg-teal-50 p-3">
                <p className="text-xs text-teal-700">Con FAE</p>
                <p className="font-semibold text-teal-900">{result.summary.conFae}</p>
              </div>
              <div className="rounded-lg bg-orange-50 p-3">
                <p className="text-xs text-orange-700">FAE pend. acept.</p>
                <p className="font-semibold text-orange-900">{result.summary.faePendiente}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400">Consultando CXP + FAE en NAF…</div>
          ) : isError ? (
            <div className="p-12 text-center text-red-600">
              {(error as Error)?.message ?? "Error al cargar cuentas por pagar."}
            </div>
          ) : (
            <>
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
              <div className="overflow-auto max-h-[calc(100vh-18rem)]">
                <table data-table-id="cuentas-por-pagar" className="w-full text-sm">
                  <thead>
                    <TableColumnFilterHead
                      tableId="cuentas-por-pagar"
                      defaultColumnWidths={{
                        expand: 40,
                        fecha: 100,
                        faeFecha: 100,
                        compania: 100,
                        proveedor: 200,
                        tipo: 60,
                        noDocu: 110,
                        noFisico: 90,
                        faeConsecutivo: 170,
                        monto: 110,
                        faeTotal: 110,
                        saldo: 110,
                        estado: 120,
                        faeAceptacion: 130,
                        aplic: 60,
                      }}
                      columns={columnDefs}
                      rows={rows}
                      filters={columnFilters}
                      onFilterChange={onColumnFilterChange}
                      filterRowClassName="bg-slate-50"
                    />
                  </thead>
                  <tbody>
                    {displayedRows.length === 0 ? (
                      <tr>
                        <td colSpan={COLSPAN} className="p-12 text-center text-slate-400">
                          No hay facturas CXP/FAE para {monthLabel} {periodYear}.
                        </td>
                      </tr>
                    ) : (
                      displayedRows.map((row) => {
                        const open = expandedId === row.id;
                        return (
                          <Fragment key={row.id}>
                            <tr
                              className={cn(
                                "border-b border-slate-100 hover:bg-slate-50/80",
                                row.origen === "FAE" && "bg-violet-50/40",
                              )}
                            >
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-slate-200 text-slate-500"
                                  title={open ? "Ocultar trazabilidad" : "Ver trazabilidad y amarres"}
                                  onClick={() => setExpandedId(open ? null : row.id)}
                                >
                                  <ChevronDown
                                    className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                                  />
                                </button>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {row.origen === "CXP" ? formatDate(row.fecha) : "—"}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {row.faeFecha ? formatDate(row.faeFecha) : "—"}
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-slate-800">
                                  {row.companyCode ?? row.noCia}
                                </div>
                                {row.companyName && (
                                  <div className="text-xs text-slate-400">{row.companyName}</div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="whitespace-nowrap" title={row.proveedor}>
                                  {row.proveedor}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {row.noProve || "—"}
                                  {row.cedula ? ` · ${row.cedula}` : ""}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" title={row.tipoDocDesc ?? row.tipoDoc}>
                                  {row.tipoDoc}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                                {row.origen === "CXP" ? row.noDocu : "—"}
                              </td>
                              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                                {row.noFisico ?? "—"}
                              </td>
                              <td className="px-3 py-2 tabular-nums whitespace-nowrap text-xs" title={row.faeClave ?? undefined}>
                                {row.faeConsecutivo ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                                {row.origen === "CXP" ? formatCurrency(row.monto) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                                {row.faeTotal != null ? formatCurrency(row.faeTotal) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                                {row.origen === "CXP" ? formatCurrency(row.saldo) : "—"}
                              </td>
                              <td className="px-3 py-2">{estadoBadge(row.estado)}</td>
                              <td className="px-3 py-2">{faeAceptacionBadge(row)}</td>
                              <td className="px-3 py-2 text-center tabular-nums">
                                {row.origen === "CXP" ? row.nAplicaciones : "—"}
                              </td>
                            </tr>
                            {open ? (
                              <tr>
                                <td colSpan={COLSPAN} className="p-0">
                                  <TraceabilityPanel row={row} />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm">
                <p className="text-slate-500">
                  Página {page} de {totalPages} · {total} registro{total === 1 ? "" : "s"}
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
