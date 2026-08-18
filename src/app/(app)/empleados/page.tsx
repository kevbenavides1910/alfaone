"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  FileSpreadsheet,
  Search,
  Upload,
  UserCircle,
  MapPin,
  Briefcase,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth/client-session";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { formatDate } from "@/lib/utils/format";
import { canImportEmployeesSession } from "@/modules/core/permissions";
import { useCompanies } from "@/lib/hooks/use-companies";
import { companySapLabel } from "@/modules/empleados/business/company-sap";

interface EmployeeRow {
  id: string;
  codigoEmpleado: string;
  nombre: string | null;
  cedula: string | null;
  email: string | null;
  telefono: string | null;
  zona: string | null;
  estado: string | null;
  oficial: boolean;
  companySapCode: string | null;
  company: string | null;
  companyEntity: { code: string; name: string; sapCode: string | null } | null;
  nominaNombre: string | null;
  fechaIngreso: string | null;
  placementsCount: number;
  primaryPlacement: {
    contrato: string | null;
    ubicacionNombre: string | null;
    puestoNombre: string | null;
    contract: { id: string; licitacionNo: string; client: string } | null;
  } | null;
}

interface ListResponse {
  data: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    rows: EmployeeRow[];
  };
}

export default function EmpleadosPage() {
  const { data: session } = useSession();
  const canImport = canImportEmployeesSession(session ?? null);
  const { data: companiesData } = useCompanies();
  const companies = companiesData?.data ?? [];

  const [filters, setFilters] = useState({
    q: "",
    zona: "",
    contrato: "",
    estado: "",
    company: "",
  });
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const queryParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    if (filters.q.trim()) sp.set("q", filters.q.trim());
    if (filters.zona.trim()) sp.set("zona", filters.zona.trim());
    if (filters.contrato.trim()) sp.set("contrato", filters.contrato.trim());
    if (filters.estado.trim()) sp.set("estado", filters.estado.trim());
    if (filters.company.trim()) sp.set("company", filters.company.trim());
    return sp.toString();
  }, [filters, page]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["empleados", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/empleados?${queryParams}`);
      if (!res.ok) throw new Error("Error al cargar empleados");
      return (await res.json()) as ListResponse;
    },
  });

  const rows = data?.data.rows ?? [];
  const total = data?.data.total ?? 0;
  const totalPages = data?.data.totalPages ?? 1;
  const empleadoColumns: TableColumnFilterDef<EmployeeRow>[] = [
    { key: "empleado", label: "Empleado", headerClassName: "px-4 py-3", filterClassName: "px-4 py-1.5", getValue: (r) => r.nombre ?? "" },
    { key: "contacto", label: "Contacto", headerClassName: "px-4 py-3", filterClassName: "px-4 py-1.5", getValue: (r) => r.email ?? r.telefono ?? "" },
    { key: "contrato", label: "Contrato / ubicación", headerClassName: "px-4 py-3", filterClassName: "px-4 py-1.5", getValue: (r) => r.primaryPlacement?.contract?.licitacionNo ?? r.primaryPlacement?.contrato ?? r.primaryPlacement?.ubicacionNombre ?? "" },
    { key: "zona", label: "Zona", headerClassName: "px-4 py-3", filterClassName: "px-4 py-1.5", getValue: (r) => r.zona ?? "" },
    { key: "estado", label: "Estado", headerClassName: "px-4 py-3", filterClassName: "px-4 py-1.5", getValue: (r) => r.estado ?? "" },
    { key: "acciones", label: "Acciones", headerClassName: "px-4 py-3 text-right", filterable: false, getValue: () => "" },
  ];
  const displayedRows = filterRowsByColumnFilters(rows, columnFilters, empleadoColumns);

  function handleExport() {
    exportRowsToExcel({
      filename: "directorio_empleados",
      sheetName: "Empleados",
      rows: displayedRows.map((r) => ({
        Código: r.codigoEmpleado,
        Nombre: r.nombre ?? "",
        Cédula: r.cedula ?? "",
        Email: r.email ?? "",
        Teléfono: r.telefono ?? "",
        Zona: r.zona ?? "",
        Estado: r.estado ?? "",
        Compañía: companySapLabel(
          r.companySapCode,
          r.company ?? r.companyEntity?.code,
          r.companyEntity?.name,
        ),
        Nómina: r.nominaNombre ?? "",
        Contrato: r.primaryPlacement?.contract?.licitacionNo ?? r.primaryPlacement?.contrato ?? "",
        Ubicación: r.primaryPlacement?.ubicacionNombre ?? "",
        Puesto: r.primaryPlacement?.puestoNombre ?? "",
        Asignaciones: r.placementsCount,
      })),
    });
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Topbar title="Empleados · Directorio" />
      <div className="flex-1 p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-red-600" />
              Directorio de empleados
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {total.toLocaleString("es-CR")} empleado(s) · contratos, ubicaciones y datos bancarios
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={displayedRows.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar
            </Button>
            {canImport && (
              <Button size="sm" asChild>
                <Link href="/empleados/importar">
                  <Upload className="h-4 w-4 mr-1" /> Importar CSV
                </Link>
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por código, nombre, cédula o email…"
                  className="pl-9"
                  value={filters.q}
                  onChange={(e) => {
                    setPage(1);
                    setFilters((f) => ({ ...f, q: e.target.value }));
                  }}
                />
              </div>
              <Input
                placeholder="Zona"
                value={filters.zona}
                onChange={(e) => {
                  setPage(1);
                  setFilters((f) => ({ ...f, zona: e.target.value }));
                }}
              />
              <Input
                placeholder="Contrato / licitación"
                value={filters.contrato}
                onChange={(e) => {
                  setPage(1);
                  setFilters((f) => ({ ...f, contrato: e.target.value }));
                }}
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filters.company}
                onChange={(e) => {
                  setPage(1);
                  setFilters((f) => ({ ...f, company: e.target.value }));
                }}
              >
                <option value="">Todas las compañías</option>
                {companies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                    {c.sapCode ? ` (${c.sapCode})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading && <div className="p-8 text-center text-slate-500">Cargando…</div>}
            {isError && <div className="p-8 text-center text-rose-600">No se pudo cargar el directorio.</div>}
            {!isLoading && !isError && rows.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                No hay empleados con esos filtros.
                {canImport && (
                  <>
                    {" "}
                    <Link href="/empleados/importar" className="text-red-600 hover:underline">
                      Importar CSV
                    </Link>
                  </>
                )}
              </div>
            )}
            {rows.length > 0 && (
              <div className="overflow-x-auto">
                <table data-table-id="empleados-listado" className="w-full text-sm">
                  <thead>
                    <TableColumnFilterHead
                      tableId="empleados-listado"
                      defaultColumnWidths={{
                        empleado: 200,
                        contacto: 160,
                        contrato: 140,
                        zona: 120,
                        estado: 100,
                        acciones: 90,
                      }}
                      columns={empleadoColumns}
                      rows={rows}
                      filters={columnFilters}
                      onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                      headerRowClassName="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"
                    />
                  </thead>
                  <tbody>
                    {displayedRows.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{r.nombre ?? "—"}</div>
                          <div className="text-xs text-slate-500 font-mono">{r.codigoEmpleado}</div>
                          {r.cedula && <div className="text-xs text-slate-500">Céd. {r.cedula}</div>}
                          {(r.companyEntity || r.companySapCode) && (
                            <div className="text-xs text-slate-600 mt-0.5">
                              {companySapLabel(
                                r.companySapCode,
                                r.company ?? r.companyEntity?.code,
                                r.companyEntity?.name,
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <div className="truncate max-w-[180px]">{r.email ?? "—"}</div>
                          <div className="text-xs">{r.telefono ?? ""}</div>
                        </td>
                        <td className="px-4 py-3">
                          {r.primaryPlacement ? (
                            <div className="space-y-0.5">
                              <div className="flex items-start gap-1 text-slate-700">
                                <Briefcase className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                                <span className="line-clamp-1">
                                  {r.primaryPlacement.contract?.licitacionNo ??
                                    r.primaryPlacement.contrato ??
                                    "Sin contrato"}
                                </span>
                              </div>
                              <div className="flex items-start gap-1 text-xs text-slate-500">
                                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span className="line-clamp-2">
                                  {r.primaryPlacement.ubicacionNombre ?? "—"}
                                  {r.primaryPlacement.puestoNombre
                                    ? ` · ${r.primaryPlacement.puestoNombre}`
                                    : ""}
                                </span>
                              </div>
                              {r.placementsCount > 1 && (
                                <Badge variant="secondary" className="text-[10px]">
                                  +{r.placementsCount - 1} asignación(es)
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">Sin asignación</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.zona ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={r.estado?.toUpperCase() === "A" ? "success" : r.estado?.toUpperCase() === "I" ? "secondary" : "secondary"}>
                            {r.estado?.toUpperCase() === "A"
                              ? "Activo"
                              : r.estado?.toUpperCase() === "I"
                                ? "Inactivo"
                                : r.estado ?? "—"}
                          </Badge>
                          {r.oficial && (
                            <Badge variant="outline" className="ml-1 text-[10px]">
                              Oficial
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/empleados/${encodeURIComponent(r.codigoEmpleado)}`}>
                              <Eye className="h-4 w-4 mr-1" /> Ver
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm text-slate-600">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
