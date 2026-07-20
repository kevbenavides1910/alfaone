"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";
import { useSession } from "@/lib/auth/client-session";
import { exportRowsToExcel, exportWorkbookToExcel } from "@/lib/utils/excel-export";
import { formatCurrency, formatDate, formatDateTime, formatPctPoints } from "@/lib/utils/format";
import {
  formatAsistenciaContratosLabel,
  formatParticipacion,
  type NafAsistenciaContratoAsignado,
} from "@/modules/empleados-naf/business/nomina-asistencia-format";
import { hasPermission } from "@/lib/permissions/check";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import {
  TableColumnFilterHead,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";

type EmpresaOption = {
  noCia: string;
  companyCode: string | null;
  companyLabel: string;
};

type PeriodoOption = {
  ano: number;
  fDesde: string;
  fHasta: string;
  label: string;
  descri: string | null;
  empresas: number;
};

type PlanillaOption = {
  noCia: string;
  companyLabel: string;
  codPla: string;
  nominaNombre: string | null;
  label: string;
};

type SelectedRango = {
  ano: number;
  fDesde: string;
  fHasta: string;
};

type CargasSocialesFields = {
  cargasSocialesPct: number;
  cargasSocialesMonto: number;
  brutoConCargasSociales: number;
};

type EmpresaResumen = {
  noCia: string;
  companyCode: string | null;
  companyLabel: string;
  empleados: number;
  devengado: number;
  deducciones: number;
  neto: number;
} & CargasSocialesFields;

type NominaContractSource = "rol" | "placement" | "empleado" | "zona" | "planilla" | "inferido";

type EmpleadoRow = {
  noCia: string;
  companyCode: string | null;
  companyLabel: string;
  noEmple: string;
  sourceKey: string;
  nombre: string | null;
  noRol: string | null;
  contrato: string | null;
  contratoRrhh: string | null;
  contratoNormalizado: string | null;
  contractId: string | null;
  licitacionNo: string | null;
  client: string | null;
  contratoSource: NominaContractSource | null;
  unresolvedContract?: boolean;
  codPla: string;
  nominaNombre: string | null;
  devengado: number;
  deducciones: number;
  neto: number;
  diasAsistenciaTotal: number;
  marcasAsistenciaTotal: number;
  horasAsistenciaTotal: number;
  pagoRolAsistenciaTotal: number;
  contratosAsistenciaCount: number;
  contratosAsistencia: (NafAsistenciaContratoAsignado & CargasSocialesFields)[];
} & CargasSocialesFields;

type ContratoResumen = {
  contratoRrhh: string;
  contratoNormalizado: string | null;
  contractId: string | null;
  licitacionNo: string | null;
  client: string | null;
  empleados: number;
  dias?: number;
  horas?: number;
  pagoRol?: number;
  devengado: number;
  deducciones: number;
  neto: number;
  sinVinculo: boolean;
  clasificacion?: "directa" | "inferida";
} & CargasSocialesFields;

type AsistenciaDetalleRow = {
  noCia: string;
  companyLabel: string;
  noEmple: string;
  nombre: string | null;
  noContrato: string;
  licitacionNo: string | null;
  client: string | null;
  dias: number;
  marcas: number;
  diasConMarca: number;
  horas: number;
  pagoRol: number;
  participacion: number;
  devengado: number;
  deducciones: number;
  neto: number;
} & CargasSocialesFields;

type CatalogResponse = {
  data: {
    empresas: EmpresaOption[];
    lastSync: {
      status: string;
      startedAt: string;
      finishedAt: string | null;
      rowsFetched: number;
      rowsUpserted: number;
      desdeAno: number | null;
      errorMessage: string | null;
    } | null;
  };
};

type PeriodosResponse = {
  data: {
    periodos: PeriodoOption[];
    planillas: PlanillaOption[];
  };
};

type DetalleResponse = {
  data: {
    detalle: {
      ano: number;
      fDesde: string;
      fHasta: string;
      noCias: string[];
      meta: {
        descri: string | null;
        asistenciaFDesde: string;
        asistenciaFHasta: string;
        asistenciaLabel: string;
      };
      porEmpresa: EmpresaResumen[];
      porContrato: ContratoResumen[];
      asistenciaDetalle: AsistenciaDetalleRow[];
      empleados: EmpleadoRow[];
      totales: {
        empleados: number;
        devengado: number;
        deducciones: number;
        neto: number;
        cargasSocialesPct: number;
        cargasSocialesMonto: number;
        brutoConCargasSociales: number;
      };
      contratoResumen: {
        empleadosSinContrato: number;
        netoSinContrato: number;
      };
    };
  };
};

function rangoKey(p: SelectedRango) {
  return `${p.ano}|${p.fDesde}|${p.fHasta}`;
}

function sameRango(a: SelectedRango, b: SelectedRango) {
  return a.ano === b.ano && a.fDesde === b.fDesde && a.fHasta === b.fHasta;
}

function empresasQueryValue(noCias: string[]) {
  return [...noCias].sort().join(",");
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function fetchNomina(path: string) {
  const res = await fetch(`/api/empleados-naf/nomina${path}`);
  if (!res.ok) throw new Error("Error al cargar nómina NAF");
  return res.json();
}

export default function EmpleadosNafNominaPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const canSync = hasPermission(session ?? null, "empleadosNaf.sync", "edit");

  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);
  const [selectedPlanillas, setSelectedPlanillas] = useState<string[]>([]);
  const [selectedRango, setSelectedRango] = useState<SelectedRango | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [expandedEmpleados, setExpandedEmpleados] = useState<Record<string, boolean>>({});
  const debouncedSearchQ = useDebouncedValue(searchQ, 300);

  const empresasKey = empresasQueryValue(selectedEmpresas);

  const { data: catalogData } = useQuery({
    queryKey: ["empleados-naf-nomina-catalog"],
    queryFn: () => fetchNomina("") as Promise<CatalogResponse>,
    staleTime: 5 * 60_000,
  });

  const { data: periodosData, isFetching: periodosFetching, isPlaceholderData: periodosIsPlaceholder } = useQuery({
    queryKey: ["empleados-naf-nomina-periodos", empresasKey, selectedRango?.fDesde, selectedRango?.fHasta],
    queryFn: () => {
      const sp = new URLSearchParams();
      for (const noCia of selectedEmpresas) sp.append("noCia", noCia);
      if (selectedRango) {
        sp.set("fDesde", selectedRango.fDesde);
        sp.set("fHasta", selectedRango.fHasta);
      }
      return fetchNomina(`?${sp}`) as Promise<PeriodosResponse>;
    },
    enabled: selectedEmpresas.length > 0,
    placeholderData: keepPreviousData,
  });

  const detalleParams = useMemo(() => {
    if (selectedEmpresas.length === 0 || !selectedRango) return null;
    const sp = new URLSearchParams();
    for (const noCia of selectedEmpresas) sp.append("noCia", noCia);
    sp.set("fDesde", selectedRango.fDesde);
    sp.set("fHasta", selectedRango.fHasta);
    for (const codPla of selectedPlanillas) sp.append("codPla", codPla);
    if (debouncedSearchQ.trim()) sp.set("q", debouncedSearchQ.trim());
    return sp.toString();
  }, [selectedEmpresas, selectedRango, selectedPlanillas, debouncedSearchQ]);

  const {
    data: detalleData,
    isLoading: detalleLoading,
    isFetching: detalleFetching,
  } = useQuery({
    queryKey: ["empleados-naf-nomina-detalle", detalleParams],
    queryFn: () => fetchNomina(`?${detalleParams}`) as Promise<DetalleResponse>,
    enabled: Boolean(detalleParams),
    placeholderData: keepPreviousData,
  });

  const empresas = catalogData?.data.empresas ?? [];
  const periodos = periodosData?.data.periodos ?? [];
  const planillas = periodosData?.data.planillas ?? [];
  const detalle = detalleData?.data.detalle;
  const lastSync = catalogData?.data.lastSync;

  useEffect(() => {
    if (selectedEmpresas.length === 0) {
      setSelectedRango(null);
      return;
    }
    if (periodosFetching || periodosIsPlaceholder) return;
    if (periodos.length === 0) {
      setSelectedRango(null);
      return;
    }
    if (!selectedRango) {
      setSelectedRango({
        ano: periodos[0].ano,
        fDesde: periodos[0].fDesde,
        fHasta: periodos[0].fHasta,
      });
      return;
    }
    const exists = periodos.some((p) => sameRango(selectedRango, p));
    if (!exists) {
      setSelectedRango({
        ano: periodos[0].ano,
        fDesde: periodos[0].fDesde,
        fHasta: periodos[0].fHasta,
      });
    }
  }, [empresasKey, selectedEmpresas.length, periodos, periodosFetching, periodosIsPlaceholder, selectedRango]);

  const handleEmpresasChange = (values: string[]) => {
    setSelectedEmpresas(values);
    setSelectedPlanillas([]);
  };

  const planillaOptions = useMemo(
    () =>
      planillas.map((planilla) => ({
        value: `${planilla.noCia}|${planilla.codPla}`,
        label: planilla.label,
      })),
    [planillas],
  );

  const selectedRangoIndex = selectedRango
    ? periodos.findIndex((p) => sameRango(selectedRango, p))
    : -1;
  const selectedRangoMeta = selectedRangoIndex >= 0 ? periodos[selectedRangoIndex] : null;

  const syncMutation = useMutation({
    mutationFn: async (desdeAno?: number) => {
      const sp = new URLSearchParams();
      if (desdeAno != null) sp.set("desdeAno", String(desdeAno));
      const res = await fetch(`/api/empleados-naf/nomina/sync?${sp}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Error al sincronizar nómina");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-nomina-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-nomina-periodos"] });
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-nomina-detalle"] });
    },
  });

  const empleados = detalle?.empleados ?? [];
  const exportStamp = selectedRango
    ? `${selectedRango.ano}_${formatDate(selectedRango.fDesde).replace(/\//g, "-")}`
    : "all";

  const exportEmpleadoRows = (rows: EmpleadoRow[]) =>
    rows.map((row) => ({
      Empresa: row.companyLabel,
      NO_CIA: row.noCia,
      Empleado: row.noEmple,
      Nombre: row.nombre ?? "",
      Rol: row.noRol ?? "",
      Contrato: row.licitacionNo ?? row.contrato ?? "",
      Cliente: row.client ?? "",
      "Cód. planilla": row.codPla,
      Planilla: row.nominaNombre ?? "",
      "Marcas asistencia": row.marcasAsistenciaTotal ?? row.diasAsistenciaTotal,
      "Horas asistencia": row.horasAsistenciaTotal ?? 0,
      "Pago rol asistencia": row.pagoRolAsistenciaTotal ?? 0,
      "Contratos asistencia": row.contratosAsistenciaCount,
      "Detalle asistencia": formatAsistenciaContratosLabel(row.contratosAsistencia),
      Devengado: row.devengado,
      "Cargas sociales %": row.cargasSocialesPct,
      "Monto cargas sociales": row.cargasSocialesMonto,
      "Bruto + cargas": row.brutoConCargasSociales,
      Deducciones: row.deducciones,
      Neto: row.neto,
    }));

  const exportAsistenciaDetalleRows = (rows: AsistenciaDetalleRow[]) =>
    rows.map((row) => ({
      Empresa: row.companyLabel,
      NO_CIA: row.noCia,
      Empleado: row.noEmple,
      Nombre: row.nombre ?? "",
      Contrato: row.licitacionNo ?? row.noContrato,
      Cliente: row.client ?? "",
      Marcas: row.marcas ?? row.dias,
      Horas: row.horas ?? 0,
      "Pago rol": row.pagoRol ?? 0,
      "Días con marca": row.diasConMarca,
      Participación: formatParticipacion(row.participacion),
      Devengado: row.devengado,
      "Cargas sociales %": row.cargasSocialesPct,
      "Monto cargas sociales": row.cargasSocialesMonto,
      "Bruto + cargas": row.brutoConCargasSociales,
      Deducciones: row.deducciones,
      Neto: row.neto,
    }));

  const toggleEmpleadoExpanded = (rowKey: string) => {
    setExpandedEmpleados((current) => ({
      ...current,
      [rowKey]: !current[rowKey],
    }));
  };

  const columnDefs: TableColumnFilterDef<EmpleadoRow>[] = [
    {
      key: "_expand",
      label: "",
      headerClassName: "p-3 w-10",
      filterClassName: "p-3",
      getValue: () => "",
    },
    {
      key: "companyLabel",
      label: "Empresa",
      headerClassName: "p-3 font-medium whitespace-nowrap",
      filterClassName: "p-3",
      getValue: (r) => r.companyLabel,
    },
    {
      key: "noEmple",
      label: "Empleado",
      headerClassName: "p-3 font-medium whitespace-nowrap",
      filterClassName: "p-3",
      getValue: (r) => r.noEmple,
    },
    {
      key: "nombre",
      label: "Nombre",
      headerClassName: "p-3 font-medium whitespace-nowrap min-w-[200px]",
      filterClassName: "p-3",
      getValue: (r) => r.nombre ?? "",
    },
    {
      key: "noRol",
      label: "Rol",
      headerClassName: "p-3 font-medium whitespace-nowrap",
      filterClassName: "p-3",
      getValue: (r) => r.noRol ?? "",
    },
    {
      key: "contrato",
      label: "Contrato",
      headerClassName: "p-3 font-medium whitespace-nowrap min-w-[180px]",
      filterClassName: "p-3",
      getValue: (r) => r.licitacionNo ?? r.contrato ?? "",
    },
    {
      key: "client",
      label: "Cliente",
      headerClassName: "p-3 font-medium whitespace-nowrap min-w-[160px]",
      filterClassName: "p-3",
      getValue: (r) => r.client ?? "",
    },
    {
      key: "nominaNombre",
      label: "Nómina",
      headerClassName: "p-3 font-medium whitespace-nowrap min-w-[180px]",
      filterClassName: "p-3",
      getValue: (r) => `${r.codPla} ${r.nominaNombre ?? ""}`.trim(),
    },
    {
      key: "contratosAsistenciaCount",
      label: "Contratos (asist.)",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.contratosAsistenciaCount),
    },
    {
      key: "diasAsistenciaTotal",
      label: "Marcas",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.marcasAsistenciaTotal ?? r.diasAsistenciaTotal),
    },
    {
      key: "horasAsistenciaTotal",
      label: "Horas",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.horasAsistenciaTotal ?? 0),
    },
    {
      key: "devengado",
      label: "Devengado",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.devengado),
    },
    {
      key: "cargasSocialesPct",
      label: "Cargas %",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.cargasSocialesPct),
    },
    {
      key: "brutoConCargasSociales",
      label: "Bruto + cargas",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.brutoConCargasSociales),
    },
    {
      key: "deducciones",
      label: "Deducciones",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.deducciones),
    },
    {
      key: "neto",
      label: "Neto",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.neto),
    },
  ];
  const displayedRows = filterRowsByColumnFilters(empleados, columnFilters, columnDefs);
  const exportAllNominaTables = () => {
    if (!detalle) return;
    exportWorkbookToExcel({
      filename: `nomina_naf_${exportStamp}`,
      sheets: [
        {
          sheetName: "Por empresa",
          rows: detalle.porEmpresa.map((row) => ({
            Empresa: row.companyLabel,
            NO_CIA: row.noCia,
            Empleados: row.empleados,
            Devengado: row.devengado,
            "Cargas sociales %": row.cargasSocialesPct,
            "Monto cargas sociales": row.cargasSocialesMonto,
            "Bruto + cargas": row.brutoConCargasSociales,
            Deducciones: row.deducciones,
            Neto: row.neto,
          })),
          totalRow: {
            Empresa: "Total general",
            NO_CIA: "",
            Empleados: detalle.totales.empleados,
            Devengado: detalle.totales.devengado,
            "Cargas sociales %": detalle.totales.cargasSocialesPct,
            "Monto cargas sociales": detalle.totales.cargasSocialesMonto,
            "Bruto + cargas": detalle.totales.brutoConCargasSociales,
            Deducciones: detalle.totales.deducciones,
            Neto: detalle.totales.neto,
          },
        },
        {
          sheetName: "Por contrato",
          rows: detalle.porContrato.map((row) => ({
            Contrato: row.licitacionNo ?? row.contratoRrhh,
            Cliente: row.client ?? "",
            Clasificación: row.clasificacion === "inferida" ? "Inferida" : "Directa",
            Empleados: row.empleados,
            "Marcas asistencia": row.dias ?? 0,
            Devengado: row.devengado,
            "Cargas sociales %": row.cargasSocialesPct,
            "Monto cargas sociales": row.cargasSocialesMonto,
            "Bruto + cargas": row.brutoConCargasSociales,
            Deducciones: row.deducciones,
            Neto: row.neto,
            "Sin vínculo presupuestos": row.sinVinculo ? "Sí" : "No",
          })),
        },
        {
          sheetName: "Asistencia x contrato",
          rows: exportAsistenciaDetalleRows(detalle.asistenciaDetalle),
        },
        {
          sheetName: "Por empleado",
          rows: exportEmpleadoRows(displayedRows),
        },
      ],
    });
  };
  const tableLoading =
    selectedEmpresas.length > 0 &&
    selectedRango &&
    detalleLoading &&
    !detalle;

  return (
    <ModulePage wide className="space-y-4">
      <ModulePageHeader
        title="Nómina NAF"
        description="Histórico de nómina por empresa y quincena (rango de fechas) en Oracle NAF5.ARPLHS"
        icon={Wallet}
        actions={
          canSync ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate(undefined)}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`}
                />
                Sincronizar año actual
              </Button>
              <Button
                variant="outline"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate(2014)}
              >
                Backfill desde 2014
              </Button>
            </div>
          ) : undefined
        }
      />

      {(lastSync || detalle) && (
        <Card>
          <CardContent className="pt-6 flex items-start gap-3">
            <div className="rounded-lg bg-red-500/10 p-2 ring-1 ring-red-500/20">
              <Database className="h-5 w-5 text-[var(--app-primary)]" />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {detalle && (
                <p>
                  {detalle.totales.empleados} empleados · {detalle.noCias.length} empresas ·
                  Devengado {formatCurrency(detalle.totales.devengado)} · Deducciones{" "}
                  {formatCurrency(detalle.totales.deducciones)} · Neto{" "}
                  {formatCurrency(detalle.totales.neto)}
                </p>
              )}
              {lastSync && (
                <p>
                  Última sync: {formatDateTime(lastSync.finishedAt ?? lastSync.startedAt)} ·{" "}
                  {lastSync.status === "success"
                    ? `${lastSync.rowsUpserted} registros (${lastSync.desdeAno ?? "—"}+)`
                    : lastSync.status === "error"
                      ? `Error: ${lastSync.errorMessage ?? "desconocido"}`
                      : "En curso…"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {syncMutation.isError && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md p-3">
          {(syncMutation.error as Error).message}
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-3 items-stretch">
        <MultiSelect
          options={empresas.map((e) => ({
            value: e.noCia,
            label: `${e.companyLabel} (${e.noCia})`,
          }))}
          value={selectedEmpresas}
          onChange={handleEmpresasChange}
          placeholder="Seleccione empresas"
          className="w-full xl:w-[320px]"
        />

        <div className="flex items-center gap-2 xl:w-auto">
          <Button
            variant="outline"
            size="icon"
            disabled={selectedRangoIndex <= 0}
            onClick={() => {
              if (selectedRangoIndex > 0) {
                const p = periodos[selectedRangoIndex - 1];
                setSelectedRango({ ano: p.ano, fDesde: p.fDesde, fHasta: p.fHasta });
                setSelectedPlanillas([]);
              }
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <select
            className="h-10 flex-1 min-w-[280px] rounded-md border border-input bg-background px-3 text-sm"
            value={selectedRango ? rangoKey(selectedRango) : ""}
            disabled={selectedEmpresas.length === 0 || periodos.length === 0}
            onChange={(e) => {
              const [ano, fDesde, fHasta] = e.target.value.split("|");
              if (ano && fDesde && fHasta) {
                setSelectedRango({ ano: Number(ano), fDesde, fHasta });
                setSelectedPlanillas([]);
              }
            }}
          >
            {selectedEmpresas.length === 0 && (
              <option value="">Seleccione al menos una empresa</option>
            )}
            {selectedEmpresas.length > 0 && periodos.length === 0 && !periodosFetching && (
              <option value="">Sin periodos para las empresas seleccionadas</option>
            )}
            {selectedEmpresas.length > 0 && periodosFetching && periodos.length === 0 && (
              <option value="">Cargando periodos…</option>
            )}
            {periodos.map((p) => (
              <option key={rangoKey(p)} value={rangoKey(p)}>
                {p.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon"
            disabled={selectedRangoIndex < 0 || selectedRangoIndex >= periodos.length - 1}
            onClick={() => {
              if (selectedRangoIndex >= 0 && selectedRangoIndex < periodos.length - 1) {
                const p = periodos[selectedRangoIndex + 1];
                setSelectedRango({ ano: p.ano, fDesde: p.fDesde, fHasta: p.fHasta });
                setSelectedPlanillas([]);
              }
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <MultiSelect
          options={planillaOptions}
          value={selectedPlanillas}
          onChange={setSelectedPlanillas}
          placeholder={
            selectedEmpresas.length === 0 || !selectedRango
              ? "Seleccione empresa y quincena"
              : planillaOptions.length === 0
                ? "Sin planillas en la quincena"
                : "Todas las planillas"
          }
          className="w-full xl:w-[360px]"
        />

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar empleado, contrato, nómina…"
            className="pl-9"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>

        <Button
          variant="outline"
          onClick={exportAllNominaTables}
          disabled={!detalle}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (todas las tablas)
        </Button>
      </div>

      {selectedRangoMeta && (
        <p className="text-sm text-slate-600">
          Quincena {formatDate(selectedRangoMeta.fDesde)} – {formatDate(selectedRangoMeta.fHasta)}
          {selectedEmpresas.length > 1
            ? ` · ${selectedRangoMeta.empresas}/${selectedEmpresas.length} empresas con datos en este rango`
            : ""}
          {selectedRangoMeta.descri ? ` · ${selectedRangoMeta.descri}` : ""}
          {detalle?.meta.asistenciaLabel
            ? ` · Asistencia ${detalle.meta.asistenciaLabel}`
            : ""}
        </p>
      )}

      {detalle && detalle.porContrato.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="px-4 py-3 border-b bg-slate-50 text-sm font-medium flex items-center justify-between gap-2">
              <div>
                <div>Planilla por contrato (salario proporcional por horas y precio del rol)</div>
                <div className="text-xs font-normal text-slate-500 mt-0.5">
                  Cada oficial reparte su salario entre los contratos según horas trabajadas y el pago del rol NAF
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportRowsToExcel({
                    filename: `nomina_naf_contratos_${exportStamp}`,
                    sheetName: "Por contrato",
                    rows: detalle.porContrato.map((row) => ({
                      Contrato: row.licitacionNo ?? row.contratoRrhh,
                      Cliente: row.client ?? "",
                      Clasificación: row.clasificacion === "inferida" ? "Inferida" : "Directa",
                      Empleados: row.empleados,
                      Horas: row.horas ?? 0,
                      "Pago rol": row.pagoRol ?? 0,
                      "Marcas asistencia": row.dias ?? 0,
                      Devengado: row.devengado,
                      "Cargas sociales %": row.cargasSocialesPct,
                      "Monto cargas sociales": row.cargasSocialesMonto,
                      "Bruto + cargas": row.brutoConCargasSociales,
                      Deducciones: row.deducciones,
                      Neto: row.neto,
                      "Sin vínculo presupuestos": row.sinVinculo ? "Sí" : "No",
                    })),
                  })
                }
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
            <table className="premium-table w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-3 text-left font-medium">Contrato</th>
                  <th className="p-3 text-left font-medium">Cliente</th>
                  <th className="p-3 text-right font-medium">Empleados</th>
                  <th className="p-3 text-right font-medium">Horas</th>
                  <th className="p-3 text-right font-medium">Pago rol</th>
                  <th className="p-3 text-right font-medium">Devengado</th>
                  <th className="p-3 text-right font-medium">Cargas %</th>
                  <th className="p-3 text-right font-medium">Bruto + cargas</th>
                  <th className="p-3 text-right font-medium">Deducciones</th>
                  <th className="p-3 text-right font-medium">Neto</th>
                </tr>
              </thead>
              <tbody>
                {detalle.porContrato.map((row) => (
                  <tr
                    key={row.contractId ?? row.contratoNormalizado ?? row.contratoRrhh}
                    className={`border-b hover:bg-slate-50/80 ${row.clasificacion === "inferida" ? "bg-amber-50/60" : ""}`}
                  >
                    <td className="p-3">
                      <div className="font-medium">{row.licitacionNo ?? row.contratoRrhh}</div>
                      {row.clasificacion === "inferida" && (
                        <div className="text-xs text-amber-700">Asignación inferida — revisar en homologación</div>
                      )}
                      {row.sinVinculo && row.clasificacion !== "inferida" && (
                        <div className="text-xs text-amber-700">Sin vínculo en presupuestos</div>
                      )}
                    </td>
                    <td className="p-3">{row.client ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{row.empleados}</td>
                    <td className="p-3 text-right tabular-nums">{row.horas ?? 0}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.pagoRol ?? 0)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.devengado)}</td>
                    <td className="p-3 text-right tabular-nums">{formatPctPoints(row.cargasSocialesPct)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.brutoConCargasSociales)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.deducciones)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{formatCurrency(row.neto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {detalle && detalle.porEmpresa.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="px-4 py-3 border-b bg-slate-50 text-sm font-medium flex items-center justify-between gap-2">
              <div>
                <div>Resumen por empresa</div>
                <div className="text-xs font-normal text-slate-500 mt-0.5">
                  Total de planilla por empresa; el desglose por contrato usa horas y precio del rol NAF
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportRowsToExcel({
                    filename: `nomina_naf_empresas_${exportStamp}`,
                    sheetName: "Por empresa",
                    rows: detalle.porEmpresa.map((row) => ({
                      Empresa: row.companyLabel,
                      NO_CIA: row.noCia,
                      Empleados: row.empleados,
                      Devengado: row.devengado,
                      "Cargas sociales %": row.cargasSocialesPct,
                      "Monto cargas sociales": row.cargasSocialesMonto,
                      "Bruto + cargas": row.brutoConCargasSociales,
                      Deducciones: row.deducciones,
                      Neto: row.neto,
                    })),
                    totalRow: {
                      Empresa: "Total general",
                      NO_CIA: "",
                      Empleados: detalle.totales.empleados,
                      Devengado: detalle.totales.devengado,
                      "Cargas sociales %": detalle.totales.cargasSocialesPct,
                      "Monto cargas sociales": detalle.totales.cargasSocialesMonto,
                      "Bruto + cargas": detalle.totales.brutoConCargasSociales,
                      Deducciones: detalle.totales.deducciones,
                      Neto: detalle.totales.neto,
                    },
                  })
                }
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
            <table className="premium-table w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-3 text-left font-medium">Empresa</th>
                  <th className="p-3 text-right font-medium">Empleados</th>
                  <th className="p-3 text-right font-medium">Devengado</th>
                  <th className="p-3 text-right font-medium">Cargas %</th>
                  <th className="p-3 text-right font-medium">Bruto + cargas</th>
                  <th className="p-3 text-right font-medium">Deducciones</th>
                  <th className="p-3 text-right font-medium">Neto</th>
                </tr>
              </thead>
              <tbody>
                {detalle.porEmpresa.map((row) => (
                  <tr key={row.noCia} className="border-b hover:bg-slate-50/80">
                    <td className="p-3">
                      <div className="font-medium">{row.companyLabel}</div>
                      <div className="text-xs text-slate-500">NO_CIA {row.noCia}</div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{row.empleados}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.devengado)}</td>
                    <td className="p-3 text-right tabular-nums">{formatPctPoints(row.cargasSocialesPct)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.brutoConCargasSociales)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.deducciones)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">
                      {formatCurrency(row.neto)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-semibold">
                  <td className="p-3">Total general</td>
                  <td className="p-3 text-right tabular-nums">{detalle.totales.empleados}</td>
                  <td className="p-3 text-right tabular-nums">
                    {formatCurrency(detalle.totales.devengado)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatPctPoints(detalle.totales.cargasSocialesPct)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatCurrency(detalle.totales.brutoConCargasSociales)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatCurrency(detalle.totales.deducciones)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatCurrency(detalle.totales.neto)}
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {detalle && detalle.asistenciaDetalle.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-x-auto max-h-[50vh] overflow-y-auto">
            <div className="px-4 py-3 border-b bg-slate-50 text-sm font-medium flex items-center justify-between gap-2 sticky top-0 z-20">
              <div>
                <div>Marcas y salario por contrato (detalle de asistencia)</div>
                <div className="text-xs font-normal text-slate-500 mt-0.5">
                  Periodo asistencia {detalle.meta.asistenciaLabel} · una fila por empleado y contrato
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportRowsToExcel({
                    filename: `nomina_naf_asistencia_${exportStamp}`,
                    sheetName: "Asistencia x contrato",
                    rows: exportAsistenciaDetalleRows(detalle.asistenciaDetalle),
                  })
                }
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel ({detalle.asistenciaDetalle.length})
              </Button>
            </div>
            <table className="premium-table w-full text-sm min-w-[1200px]">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b bg-slate-50">
                  <th className="p-3 text-left font-medium">Empresa</th>
                  <th className="p-3 text-left font-medium">Empleado</th>
                  <th className="p-3 text-left font-medium">Nombre</th>
                  <th className="p-3 text-left font-medium">Contrato</th>
                  <th className="p-3 text-left font-medium">Cliente</th>
                  <th className="p-3 text-right font-medium">Horas</th>
                  <th className="p-3 text-right font-medium">Pago rol</th>
                  <th className="p-3 text-right font-medium">Marcas</th>
                  <th className="p-3 text-right font-medium">Con marca</th>
                  <th className="p-3 text-right font-medium">%</th>
                  <th className="p-3 text-right font-medium">Devengado</th>
                  <th className="p-3 text-right font-medium">Cargas %</th>
                  <th className="p-3 text-right font-medium">Bruto + cargas</th>
                  <th className="p-3 text-right font-medium">Deducciones</th>
                  <th className="p-3 text-right font-medium">Neto</th>
                </tr>
              </thead>
              <tbody>
                {detalle.asistenciaDetalle.map((row) => (
                  <tr
                    key={`${row.noEmple}-${row.noContrato}-${row.dias}`}
                    className="border-b hover:bg-slate-50/80"
                  >
                    <td className="p-3 whitespace-nowrap">{row.companyLabel}</td>
                    <td className="p-3 font-mono text-xs whitespace-nowrap">{row.noEmple}</td>
                    <td className="p-3 whitespace-nowrap">{row.nombre ?? "—"}</td>
                    <td className="p-3 whitespace-nowrap">{row.licitacionNo ?? row.noContrato}</td>
                    <td className="p-3 whitespace-nowrap">{row.client ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{row.horas ?? 0}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.pagoRol ?? 0)}</td>
                    <td className="p-3 text-right tabular-nums">{row.marcas ?? row.dias}</td>
                    <td className="p-3 text-right tabular-nums">{row.diasConMarca}</td>
                    <td className="p-3 text-right tabular-nums">{formatParticipacion(row.participacion)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.devengado)}</td>
                    <td className="p-3 text-right tabular-nums">{formatPctPoints(row.cargasSocialesPct)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.brutoConCargasSociales)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.deducciones)}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{formatCurrency(row.neto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto max-h-[60vh] overflow-y-auto">
          <div className="px-4 py-3 border-b bg-slate-50 text-sm font-medium flex items-center justify-between gap-2 sticky top-0 z-20">
            <span>Detalle por empleado (incluye contratos según asistencia NAF)</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportRowsToExcel({
                  filename: `nomina_naf_empleados_${exportStamp}`,
                  sheetName: "Por empleado",
                  rows: exportEmpleadoRows(displayedRows),
                })
              }
              disabled={displayedRows.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Excel ({displayedRows.length})
            </Button>
          </div>
          <table className="premium-table w-full text-sm min-w-[1100px]">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <TableColumnFilterHead
                columns={columnDefs}
                rows={empleados}
                filters={columnFilters}
                onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
              />
            </thead>
            <tbody>
              {tableLoading && (
                <tr>
                  <td colSpan={columnDefs.length} className="p-8 text-center text-slate-500">
                    Cargando nómina NAF…
                  </td>
                </tr>
              )}
              {!tableLoading && selectedEmpresas.length === 0 && (
                <tr>
                  <td colSpan={columnDefs.length} className="p-8 text-center text-slate-500">
                    <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Seleccione una o más empresas para ver la nómina.
                  </td>
                </tr>
              )}
              {!tableLoading && selectedEmpresas.length > 0 && !selectedRango && (
                <tr>
                  <td colSpan={columnDefs.length} className="p-8 text-center text-slate-500">
                    Seleccione una quincena de nómina.
                  </td>
                </tr>
              )}
              {!tableLoading &&
                selectedEmpresas.length > 0 &&
                selectedRango &&
                empleados.length === 0 && (
                  <tr>
                    <td colSpan={columnDefs.length} className="p-8 text-center text-slate-500">
                      Sin empleados para las empresas y periodo seleccionados.
                    </td>
                  </tr>
                )}
              {displayedRows.map((row) => {
                const rowKey = `${row.sourceKey}-${row.codPla}`;
                const expanded = expandedEmpleados[rowKey];
                const canExpand = row.contratosAsistencia.length > 0;
                return (
                  <Fragment key={rowKey}>
                    <tr className="border-b hover:bg-slate-50/80">
                      <td className="p-3">
                        {canExpand ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleEmpleadoExpanded(rowKey)}
                            aria-label={expanded ? "Ocultar detalle" : "Ver detalle por contrato"}
                          >
                            {expanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        ) : null}
                      </td>
                      <td className="p-3 whitespace-nowrap">{row.companyLabel}</td>
                      <td className="p-3 font-mono text-xs whitespace-nowrap">{row.noEmple}</td>
                      <td className="p-3 whitespace-nowrap">{row.nombre ?? "—"}</td>
                      <td className="p-3 font-mono text-xs whitespace-nowrap">{row.noRol ?? "—"}</td>
                      <td
                        className="p-3 whitespace-nowrap max-w-[220px] truncate"
                        title={row.licitacionNo ?? row.contrato ?? ""}
                      >
                        {row.licitacionNo ?? row.contrato ?? "—"}
                      </td>
                      <td className="p-3 whitespace-nowrap">{row.client ?? "—"}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-mono text-xs">{row.codPla}</span>
                        {row.nominaNombre ? ` · ${row.nominaNombre}` : ""}
                      </td>
                      <td
                        className={`p-3 text-right tabular-nums whitespace-nowrap ${
                          row.contratosAsistenciaCount > 1 ? "text-amber-700 font-semibold" : ""
                        }`}
                      >
                        {row.contratosAsistenciaCount > 0 ? row.contratosAsistenciaCount : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">
                        {(row.marcasAsistenciaTotal ?? row.diasAsistenciaTotal) > 0
                          ? row.marcasAsistenciaTotal ?? row.diasAsistenciaTotal
                          : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">
                        {(row.horasAsistenciaTotal ?? 0) > 0 ? row.horasAsistenciaTotal : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">
                        {formatCurrency(row.devengado)}
                      </td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">
                        {formatPctPoints(row.cargasSocialesPct)}
                      </td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">
                        {formatCurrency(row.brutoConCargasSociales)}
                      </td>
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">
                        {formatCurrency(row.deducciones)}
                      </td>
                      <td className="p-3 text-right tabular-nums font-medium whitespace-nowrap">
                        {formatCurrency(row.neto)}
                      </td>
                    </tr>
                    {expanded && canExpand && (
                      <tr className="border-b bg-slate-50/70">
                        <td />
                        <td colSpan={columnDefs.length} className="p-3">
                          <table className="w-full text-xs border rounded-md overflow-hidden bg-white">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="p-2 text-left font-medium">Contrato</th>
                                <th className="p-2 text-left font-medium">Cliente</th>
                                <th className="p-2 text-right font-medium">Horas</th>
                                <th className="p-2 text-right font-medium">Pago rol</th>
                                <th className="p-2 text-right font-medium">Marcas</th>
                                <th className="p-2 text-right font-medium">Con marca</th>
                                <th className="p-2 text-right font-medium">%</th>
                                <th className="p-2 text-right font-medium">Devengado</th>
                                <th className="p-2 text-right font-medium">Cargas %</th>
                                <th className="p-2 text-right font-medium">Bruto + cargas</th>
                                <th className="p-2 text-right font-medium">Deducciones</th>
                                <th className="p-2 text-right font-medium">Neto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.contratosAsistencia.map((contrato) => (
                                <tr key={contrato.noContrato} className="border-t">
                                  <td className="p-2">{contrato.licitacionNo ?? contrato.noContrato}</td>
                                  <td className="p-2">{contrato.client ?? "—"}</td>
                                  <td className="p-2 text-right tabular-nums">
                                    {contrato.horas ?? 0}
                                  </td>
                                  <td className="p-2 text-right tabular-nums">
                                    {formatCurrency(contrato.pagoRol ?? 0)}
                                  </td>
                                  <td className="p-2 text-right tabular-nums">
                                    {contrato.marcas ?? contrato.dias}
                                  </td>
                                  <td className="p-2 text-right tabular-nums">{contrato.diasConMarca}</td>
                                  <td className="p-2 text-right tabular-nums">
                                    {formatParticipacion(contrato.participacion)}
                                  </td>
                                  <td className="p-2 text-right tabular-nums">
                                    {formatCurrency(contrato.devengado)}
                                  </td>
                                  <td className="p-2 text-right tabular-nums">
                                    {formatPctPoints(contrato.cargasSocialesPct)}
                                  </td>
                                  <td className="p-2 text-right tabular-nums">
                                    {formatCurrency(contrato.brutoConCargasSociales)}
                                  </td>
                                  <td className="p-2 text-right tabular-nums">
                                    {formatCurrency(contrato.deducciones)}
                                  </td>
                                  <td className="p-2 text-right tabular-nums font-medium">
                                    {formatCurrency(contrato.neto)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {(detalleFetching || periodosFetching) && (
        <p className="text-xs text-slate-500">Actualizando datos…</p>
      )}
    </ModulePage>
  );
}
