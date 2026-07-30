"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";
import { exportRowsToExcel, exportWorkbookToExcel } from "@/lib/utils/excel-export";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import {
  TableColumnFilterHead,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { cn } from "@/lib/utils/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";

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

type RevisionRow = {
  noCia: string;
  companyCode: string | null;
  companyLabel: string;
  codPla: string;
  nominaNombre: string | null;
  estado: string | null;
  estadoLabel: string | null;
  empleados: number;
  ingresos: number;
  deducciones: number;
  liquido: number;
  cheque: number;
  davivienda: number;
  bn: number;
  otro: number;
  sumaFormasPago: number;
  diferencia: number;
  revisada: boolean;
  generada: boolean;
  pagada: boolean;
  pagadaCk: boolean;
  pagadaDav: boolean;
  pagadaBn: boolean;
};

type ChecklistField = "revisada" | "generada" | "pagada" | "pagadaCk" | "pagadaDav" | "pagadaBn";

type RevisionTotales = {
  empleados: number;
  ingresos: number;
  deducciones: number;
  liquido: number;
  cheque: number;
  davivienda: number;
  bn: number;
  otro: number;
  sumaFormasPago: number;
  diferencia: number;
};

type RubroLine = {
  codigo: string;
  descripcion: string;
  cantidad: number | null;
  monto: number;
};

type RevisionDetalle = {
  noCia: string;
  companyLabel: string;
  codPla: string;
  nominaNombre: string | null;
  fDesde: string;
  fHasta: string;
  fuente: "abierta" | "cerrada";
  estado: string | null;
  estadoLabel: string | null;
  ingresos: RubroLine[];
  deducciones: RubroLine[];
  totales: { ingresos: number; deducciones: number; liquido: number };
};

type PagoCanal = "CK" | "DAV" | "BN";

type PagoTarget = {
  noCia: string;
  codPla: string;
  companyLabel: string;
  nominaNombre: string | null;
  canal: PagoCanal;
  montoUi: number;
};

type EmpleadoPago = {
  noEmple: string;
  nombre: string | null;
  cedula: string | null;
  formaPago: string | null;
  banco: string | null;
  numCuenta: string | null;
  idCta: string | null;
  liquido: number;
};

type EmpleadosPagoReporte = {
  noCia: string;
  companyLabel: string;
  codPla: string;
  nominaNombre: string | null;
  fDesde: string;
  fHasta: string;
  canal: PagoCanal;
  canalLabel: string;
  empleados: EmpleadoPago[];
  totales: { empleados: number; liquido: number };
};

type DetailTarget = {
  noCia: string;
  codPla: string;
  companyLabel: string;
  nominaNombre: string | null;
};

type CatalogResponse = {
  data: {
    empresas: EmpresaOption[];
    lastSync: { finishedAt: string | null; status: string } | null;
  };
};

type PeriodosResponse = {
  data: {
    empresas: EmpresaOption[];
    periodos: PeriodoOption[];
    planillas: PlanillaOption[];
    lastSync: { finishedAt: string | null; status: string } | null;
  };
};

type DetalleResponse = {
  data: {
    empresas: EmpresaOption[];
    periodos: PeriodoOption[];
    planillas: PlanillaOption[];
    detalle: {
      ano: number;
      fDesde: string;
      fHasta: string;
      porPlanilla: RevisionRow[];
      totales: RevisionTotales;
    };
    lastSync: { finishedAt: string | null; status: string } | null;
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

async function fetchRevision(path: string) {
  const res = await fetch(`/api/empleados-naf/nomina/revision-planilla${path}`);
  if (!res.ok) throw new Error("Error al cargar revisión de planilla");
  return res.json();
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-semibold mt-1 tabular-nums", accent)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function AmountButton({
  value,
  onClick,
  className,
  title = "Ver detalle",
  disabled = false,
}: {
  value: number;
  onClick: () => void;
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "tabular-nums text-right w-full hover:underline hover:text-[var(--app-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)] rounded-sm disabled:no-underline disabled:cursor-default disabled:opacity-60",
        className,
      )}
      title={title}
    >
      {formatCurrency(value)}
    </button>
  );
}

function canalTitulo(canal: PagoCanal) {
  if (canal === "CK") return "Cheque (CK)";
  if (canal === "DAV") return "Davivienda";
  return "Banco Nacional";
}

/** Anchos fijos para columnas sticky (scroll horizontal). */
const STICKY_COLS = {
  companyLabel: { left: 0, width: 200 },
  codPla: { left: 200, width: 96 },
  nominaNombre: { left: 296, width: 200 },
} as const;

function stickyHeadClass(key: keyof typeof STICKY_COLS) {
  const leftClass =
    key === "companyLabel" ? "left-0" : key === "codPla" ? "left-[200px]" : "left-[296px]";
  const border =
    key === "nominaNombre" ? "border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]" : "";
  return cn("sticky z-30 bg-slate-50", leftClass, border);
}

function stickyCellClass(key: keyof typeof STICKY_COLS) {
  const border = key === "nominaNombre" ? "border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]" : "";
  return cn(
    "sticky z-[5] bg-white group-hover:bg-slate-50",
    border,
  );
}

function stickyStyle(key: keyof typeof STICKY_COLS): CSSProperties {
  const col = STICKY_COLS[key];
  return {
    left: col.left,
    width: col.width,
    minWidth: col.width,
    maxWidth: col.width,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmpleadosPagoPrintHtml(reporte: EmpleadosPagoReporte) {
  const rowsHtml = reporte.empleados
    .map(
      (emp) => `<tr>
        <td>${escapeHtml(emp.noEmple)}</td>
        <td>${escapeHtml(emp.nombre ?? "")}</td>
        <td>${escapeHtml(emp.formaPago ?? "")}</td>
        <td>${escapeHtml(emp.banco ?? "")}</td>
        <td>${escapeHtml(emp.numCuenta ?? "")}</td>
        <td class="num">${formatCurrency(emp.liquido)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(reporte.canalLabel)} · ${escapeHtml(reporte.companyLabel)}</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; margin: 0; padding: 16px; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .meta { color: #444; margin-bottom: 14px; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #ccc; padding: 6px 4px; text-align: left; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: .02em; color: #333; }
    td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    tfoot td { font-weight: 700; border-top: 2px solid #222; border-bottom: none; padding-top: 8px; }
  </style>
</head>
<body>
  <h1>Pago a empleados · ${escapeHtml(reporte.canalLabel)}</h1>
  <div class="meta">
    <div><strong>${escapeHtml(reporte.companyLabel)}</strong> (${escapeHtml(reporte.noCia)})</div>
    <div>Planilla ${escapeHtml(reporte.codPla)}${reporte.nominaNombre ? ` · ${escapeHtml(reporte.nominaNombre)}` : ""}</div>
    <div>Periodo ${escapeHtml(formatDate(reporte.fDesde))} – ${escapeHtml(formatDate(reporte.fHasta))}</div>
    <div>${reporte.totales.empleados} empleado(s)</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>No. Emp.</th>
        <th>Nombre</th>
        <th>F. Pago</th>
        <th>Banco</th>
        <th>Cuenta</th>
        <th class="num">Salario neto</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || `<tr><td colspan="6">Sin empleados</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td colspan="5">TOTAL GENERAL</td>
        <td class="num">${formatCurrency(reporte.totales.liquido)}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}

/** Imprime sin popup: iframe oculto evita about:blank vacío por noopener. */
function printEmpleadosPagoReporte(reporte: EmpleadosPagoReporte) {
  const html = buildEmpleadosPagoPrintHtml(reporte);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Imprimir reporte de pago");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument ?? frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    window.alert("No se pudo preparar el documento para imprimir.");
    return;
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  let printed = false;
  const cleanup = () => {
    setTimeout(() => iframe.remove(), 800);
  };

  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      frameWindow.focus();
      frameWindow.print();
    } finally {
      cleanup();
    }
  };

  iframe.addEventListener("load", () => setTimeout(triggerPrint, 50), { once: true });
  // Fallback si el evento load no dispara tras document.write.
  setTimeout(triggerPrint, 250);
}

export default function RevisionPlanillaPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const canSync = hasPermission(session ?? null, "empleadosNaf.sync", "edit");
  const canEditChecklist = hasPermission(session ?? null, "empleadosNaf.revisionPlanilla", "edit");
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);
  const [selectedPlanillas, setSelectedPlanillas] = useState<string[]>([]);
  const [selectedRango, setSelectedRango] = useState<SelectedRango | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [pagoTarget, setPagoTarget] = useState<PagoTarget | null>(null);

  const empresasKey = empresasQueryValue(selectedEmpresas);

  const { data: catalogData } = useQuery({
    queryKey: ["empleados-naf-revision-catalog"],
    queryFn: () => fetchRevision("") as Promise<CatalogResponse>,
    staleTime: 5 * 60_000,
  });

  const {
    data: periodosData,
    isFetching: periodosFetching,
    isPlaceholderData: periodosIsPlaceholder,
  } = useQuery({
    queryKey: [
      "empleados-naf-revision-periodos",
      empresasKey,
      selectedRango?.fDesde,
      selectedRango?.fHasta,
    ],
    queryFn: () => {
      const sp = new URLSearchParams();
      for (const noCia of selectedEmpresas) sp.append("noCia", noCia);
      if (selectedRango) {
        sp.set("fDesde", selectedRango.fDesde);
        sp.set("fHasta", selectedRango.fHasta);
      }
      return fetchRevision(`?${sp}`) as Promise<PeriodosResponse>;
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
    return sp.toString();
  }, [selectedEmpresas, selectedRango, selectedPlanillas]);

  const {
    data: detalleData,
    isLoading: detalleLoading,
    isFetching: detalleFetching,
  } = useQuery({
    queryKey: ["empleados-naf-revision-detalle", detalleParams],
    queryFn: () => fetchRevision(`?${detalleParams}`) as Promise<DetalleResponse>,
    enabled: Boolean(detalleParams),
    placeholderData: keepPreviousData,
  });

  const empresas = catalogData?.data.empresas ?? [];
  const periodos = periodosData?.data.periodos ?? [];
  const planillas = periodosData?.data.planillas ?? [];
  const detalle = detalleData?.data.detalle;
  const lastSync = catalogData?.data.lastSync ?? periodosData?.data.lastSync;

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
  }, [
    empresasKey,
    selectedEmpresas.length,
    periodos,
    periodosFetching,
    periodosIsPlaceholder,
    selectedRango,
  ]);

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
    mutationFn: async () => {
      const res = await fetch("/api/empleados-naf/nomina/sync?desdeAno=2026", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Error al sincronizar nómina");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-revision-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-revision-periodos"] });
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-revision-detalle"] });
    },
  });


  const detailParams = useMemo(() => {
    if (!detailTarget || !selectedRango) return null;
    const sp = new URLSearchParams();
    sp.set("noCia", detailTarget.noCia);
    sp.set("codPla", detailTarget.codPla);
    sp.set("fDesde", selectedRango.fDesde);
    sp.set("fHasta", selectedRango.fHasta);
    return sp.toString();
  }, [detailTarget, selectedRango]);

  const {
    data: detailData,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErr,
  } = useQuery({
    queryKey: ["empleados-naf-revision-detalle-rubros", detailParams],
    queryFn: async () => {
      const res = await fetch(`/api/empleados-naf/nomina/revision-planilla/detalle?${detailParams}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Error al cargar detalle");
      return body as { data: { detalle: RevisionDetalle } };
    },
    enabled: Boolean(detailParams),
  });

  const planillaDetalle = detailData?.data.detalle ?? null;

  const pagoParams = useMemo(() => {
    if (!pagoTarget || !selectedRango) return null;
    const sp = new URLSearchParams();
    sp.set("noCia", pagoTarget.noCia);
    sp.set("codPla", pagoTarget.codPla);
    sp.set("fDesde", selectedRango.fDesde);
    sp.set("fHasta", selectedRango.fHasta);
    sp.set("canal", pagoTarget.canal);
    return sp.toString();
  }, [pagoTarget, selectedRango]);

  const {
    data: pagoData,
    isLoading: pagoLoading,
    isError: pagoError,
    error: pagoErr,
  } = useQuery({
    queryKey: ["empleados-naf-revision-empleados-pago", pagoParams],
    queryFn: async () => {
      const res = await fetch(
        `/api/empleados-naf/nomina/revision-planilla/empleados-pago?${pagoParams}`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Error al cargar empleados por forma de pago");
      return body as { data: { reporte: EmpleadosPagoReporte } };
    },
    enabled: Boolean(pagoParams),
  });

  const pagoReporte = pagoData?.data.reporte ?? null;

  const openPagoReporte = (row: RevisionRow, canal: PagoCanal) => {
    const monto = canal === "CK" ? row.cheque : canal === "DAV" ? row.davivienda : row.bn;
    if (monto <= 0) return;
    setPagoTarget({
      noCia: row.noCia,
      codPla: row.codPla,
      companyLabel: row.companyLabel,
      nominaNombre: row.nominaNombre,
      canal,
      montoUi: monto,
    });
  };

  const checklistMutation = useMutation({
    mutationFn: async (payload: {
      noCia: string;
      codPla: string;
      field: ChecklistField;
      value: boolean;
    }) => {
      if (!selectedRango) throw new Error("Seleccione una quincena");
      const res = await fetch("/api/empleados-naf/nomina/revision-planilla/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noCia: payload.noCia,
          codPla: payload.codPla,
          fDesde: selectedRango.fDesde,
          fHasta: selectedRango.fHasta,
          field: payload.field,
          value: payload.value,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "No se pudo guardar el check");
      return body as { data: { checklist: { revisada: boolean; generada: boolean; pagada: boolean; pagadaCk: boolean; pagadaDav: boolean; pagadaBn: boolean } } };
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["empleados-naf-revision-detalle", detalleParams] });
      const previous = queryClient.getQueryData<DetalleResponse>([
        "empleados-naf-revision-detalle",
        detalleParams,
      ]);
      queryClient.setQueryData<DetalleResponse>(
        ["empleados-naf-revision-detalle", detalleParams],
        (current) => {
          if (!current?.data?.detalle) return current;
          return {
            ...current,
            data: {
              ...current.data,
              detalle: {
                ...current.data.detalle,
                porPlanilla: current.data.detalle.porPlanilla.map((row) =>
                  row.noCia === payload.noCia && row.codPla === payload.codPla
                    ? { ...row, [payload.field]: payload.value }
                    : row,
                ),
              },
            },
          };
        },
      );
      return { previous };
    },
    onError: (_err, _payload, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["empleados-naf-revision-detalle", detalleParams], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-revision-detalle", detalleParams] });
    },
  });

  const planillaActionBody = (row: RevisionRow) => {
    if (!selectedRango) throw new Error("Seleccione una quincena");
    return {
      noCia: row.noCia,
      codPla: row.codPla,
      fDesde: selectedRango.fDesde,
      fHasta: selectedRango.fHasta,
    };
  };

  const aprobarMutation = useMutation({
    mutationFn: async (row: RevisionRow) => {
      const res = await fetch("/api/empleados-naf/nomina/revision-planilla/aprobar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planillaActionBody(row)),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "No se pudo aprobar en NAF");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-revision-detalle"] });
    },
  });

  const prepararMutation = useMutation({
    mutationFn: async (payload: { row: RevisionRow; replaceExisting?: boolean }) => {
      const res = await fetch("/api/empleados-naf/nomina/revision-planilla/preparar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...planillaActionBody(payload.row),
          replaceExisting: Boolean(payload.replaceExisting),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "No se pudo preparar pagos en NAF");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-revision-detalle"] });
    },
  });

  const marcarPagadaMutation = useMutation({
    mutationFn: async (row: RevisionRow) => {
      const res = await fetch("/api/empleados-naf/nomina/revision-planilla/marcar-pagada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planillaActionBody(row)),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "No se pudo marcar pagada");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-revision-detalle"] });
    },
  });

  const downloadArchivo = async (row: RevisionRow, canal: "BN" | "DAV" | "CK") => {
    if (!selectedRango) return;
    const sp = new URLSearchParams(planillaActionBody(row));
    sp.set("canal", canal);
    const res = await fetch(`/api/empleados-naf/nomina/revision-planilla/archivo?${sp}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? "No se pudo descargar el archivo");
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(cd);
    const filename = match?.[1] ?? `pago_${canal.toLowerCase()}.txt`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const actionBusy =
    aprobarMutation.isPending || prepararMutation.isPending || marcarPagadaMutation.isPending;

  const rows = detalle?.porPlanilla ?? [];
  const q = searchQ.trim().toLowerCase();
  const filteredBySearch = useMemo(() => {
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.companyLabel,
        row.noCia,
        row.codPla,
        row.nominaNombre,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, q]);

  const columnDefs: TableColumnFilterDef<RevisionRow>[] = [
    {
      key: "companyLabel",
      label: "Empresa",
      headerClassName: cn(stickyHeadClass("companyLabel"), "p-3 font-medium whitespace-nowrap"),
      filterClassName: cn(stickyHeadClass("companyLabel"), "p-3"),
      headerStyle: stickyStyle("companyLabel"),
      filterStyle: stickyStyle("companyLabel"),
      getValue: (r) => r.companyLabel,
    },
    {
      key: "codPla",
      label: "Cód. planilla",
      headerClassName: cn(stickyHeadClass("codPla"), "p-3 font-medium whitespace-nowrap"),
      filterClassName: cn(stickyHeadClass("codPla"), "p-3"),
      headerStyle: stickyStyle("codPla"),
      filterStyle: stickyStyle("codPla"),
      getValue: (r) => r.codPla,
    },
    {
      key: "nominaNombre",
      label: "Planilla",
      headerClassName: cn(stickyHeadClass("nominaNombre"), "p-3 font-medium whitespace-nowrap"),
      filterClassName: cn(stickyHeadClass("nominaNombre"), "p-3"),
      headerStyle: stickyStyle("nominaNombre"),
      filterStyle: stickyStyle("nominaNombre"),
      getValue: (r) => r.nominaNombre ?? "",
    },
    {
      key: "estado",
      label: "Estado",
      headerClassName: "p-3 font-medium whitespace-nowrap",
      filterClassName: "p-3",
      getValue: (r) => r.estadoLabel ?? r.estado ?? "Cerrada",
    },
    {
      key: "empleados",
      label: "Empleados",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.empleados),
    },
    {
      key: "ingresos",
      label: "Ingresos",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.ingresos),
    },
    {
      key: "deducciones",
      label: "Deducciones",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.deducciones),
    },
    {
      key: "liquido",
      label: "Líquido",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.liquido),
    },
    {
      key: "cheque",
      label: "Cheque (CK)",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.cheque),
    },
    {
      key: "davivienda",
      label: "Davivienda",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.davivienda),
    },
    {
      key: "bn",
      label: "BN",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.bn),
    },
    {
      key: "otro",
      label: "Otro",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.otro),
    },
    {
      key: "sumaFormasPago",
      label: "Suma F.P.",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.sumaFormasPago),
    },
    {
      key: "diferencia",
      label: "Dif.",
      headerClassName: "p-3 font-medium whitespace-nowrap text-right",
      filterClassName: "p-3",
      getValue: (r) => String(r.diferencia),
    },
    {
      key: "accionesNaf",
      label: "Acciones NAF",
      align: "center",
      filterable: false,
      headerClassName: "p-3 font-medium whitespace-nowrap text-center min-w-[220px]",
      filterClassName: "p-3",
      getValue: () => "",
    },
    {
      key: "revisada",
      label: "Revisada",
      align: "center",
      filterable: false,
      headerClassName: "p-3 font-medium whitespace-nowrap text-center min-w-[88px]",
      filterClassName: "p-3",
      getValue: (r) => (r.revisada ? "Sí" : "No"),
    },
    {
      key: "generada",
      label: "Generada",
      align: "center",
      filterable: false,
      headerClassName: "p-3 font-medium whitespace-nowrap text-center min-w-[88px]",
      filterClassName: "p-3",
      getValue: (r) => (r.generada ? "Sí" : "No"),
    },
    
  ];

  const visibleRows = useMemo(
    () => filterRowsByColumnFilters(filteredBySearch, columnFilters, columnDefs),
    [filteredBySearch, columnFilters, columnDefs],
  );

  const exportStamp = selectedRango
    ? `${selectedRango.ano}_${formatDate(selectedRango.fDesde).replace(/\//g, "-")}`
    : "all";

  const totales = detalle?.totales;
  const visibleTotales = useMemo(() => {
    return visibleRows.reduce(
      (acc, row) => ({
        empleados: acc.empleados + row.empleados,
        ingresos: acc.ingresos + row.ingresos,
        deducciones: acc.deducciones + row.deducciones,
        liquido: acc.liquido + row.liquido,
        cheque: acc.cheque + row.cheque,
        davivienda: acc.davivienda + row.davivienda,
        bn: acc.bn + row.bn,
        otro: acc.otro + row.otro,
        sumaFormasPago: acc.sumaFormasPago + row.sumaFormasPago,
        diferencia: acc.diferencia + row.diferencia,
      }),
      {
        empleados: 0,
        ingresos: 0,
        deducciones: 0,
        liquido: 0,
        cheque: 0,
        davivienda: 0,
        bn: 0,
        otro: 0,
        sumaFormasPago: 0,
        diferencia: 0,
      },
    );
  }, [visibleRows]);

  type ResumenPagoEmpresa = {
    noCia: string;
    companyLabel: string;
    planillas: number;
    cheque: number;
    davivienda: number;
    bn: number;
    otro: number;
    totalPago: number;
  };

  const resumenPagoPorEmpresa = useMemo(() => {
    const map = new Map<string, ResumenPagoEmpresa>();
    for (const row of visibleRows) {
      const key = row.noCia;
      const current = map.get(key) ?? {
        noCia: row.noCia,
        companyLabel: row.companyLabel,
        planillas: 0,
        cheque: 0,
        davivienda: 0,
        bn: 0,
        otro: 0,
        totalPago: 0,
      };
      current.planillas += 1;
      current.cheque += row.cheque;
      current.davivienda += row.davivienda;
      current.bn += row.bn;
      current.otro += row.otro;
      current.totalPago += row.cheque + row.davivienda + row.bn + row.otro;
      map.set(key, current);
    }
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        cheque: Math.round((row.cheque + Number.EPSILON) * 100) / 100,
        davivienda: Math.round((row.davivienda + Number.EPSILON) * 100) / 100,
        bn: Math.round((row.bn + Number.EPSILON) * 100) / 100,
        otro: Math.round((row.otro + Number.EPSILON) * 100) / 100,
        totalPago: Math.round((row.totalPago + Number.EPSILON) * 100) / 100,
      }))
      .sort((a, b) => a.companyLabel.localeCompare(b.companyLabel) || a.noCia.localeCompare(b.noCia));
  }, [visibleRows]);

  const resumenPagoTotales = useMemo(() => {
    return resumenPagoPorEmpresa.reduce(
      (acc, row) => ({
        planillas: acc.planillas + row.planillas,
        cheque: acc.cheque + row.cheque,
        davivienda: acc.davivienda + row.davivienda,
        bn: acc.bn + row.bn,
        otro: acc.otro + row.otro,
        totalPago: acc.totalPago + row.totalPago,
      }),
      { planillas: 0, cheque: 0, davivienda: 0, bn: 0, otro: 0, totalPago: 0 },
    );
  }, [resumenPagoPorEmpresa]);

  const exportTable = () => {
    exportWorkbookToExcel({
      filename: `revision_planilla_naf_${exportStamp}`,
      sheets: [
        {
          sheetName: "Revisión planilla",
          rows: visibleRows.map((row) => ({
            Empresa: row.companyLabel,
            NO_CIA: row.noCia,
            "Cód. planilla": row.codPla,
            Planilla: row.nominaNombre ?? "",
            Estado: row.estadoLabel ?? row.estado ?? "Cerrada",
            Empleados: row.empleados,
            Ingresos: row.ingresos,
            Deducciones: row.deducciones,
            Líquido: row.liquido,
            "Cheque (CK)": row.cheque,
            Davivienda: row.davivienda,
            BN: row.bn,
            Otro: row.otro,
            "Suma formas pago": row.sumaFormasPago,
            Diferencia: row.diferencia,
            Revisada: row.revisada ? "Sí" : "No",
            Generada: row.generada ? "Sí" : "No",
            "Pagada CK": row.pagadaCk ? "Sí" : "No",
            "Pagada DAV": row.pagadaDav ? "Sí" : "No",
            "Pagada BN": row.pagadaBn ? "Sí" : "No",
          })),
        },
        {
          sheetName: "Pago por empresa",
          rows: resumenPagoPorEmpresa.map((row) => ({
            Empresa: row.companyLabel,
            NO_CIA: row.noCia,
            Nóminas: row.planillas,
            "Cheque (CK)": row.cheque,
            Davivienda: row.davivienda,
            BN: row.bn,
            Otro: row.otro,
            "Total a pagar": row.totalPago,
          })),
          totalRow: {
            Empresa: "TOTAL",
            NO_CIA: "",
            Nóminas: resumenPagoTotales.planillas,
            "Cheque (CK)": Math.round((resumenPagoTotales.cheque + Number.EPSILON) * 100) / 100,
            Davivienda: Math.round((resumenPagoTotales.davivienda + Number.EPSILON) * 100) / 100,
            BN: Math.round((resumenPagoTotales.bn + Number.EPSILON) * 100) / 100,
            Otro: Math.round((resumenPagoTotales.otro + Number.EPSILON) * 100) / 100,
            "Total a pagar": Math.round((resumenPagoTotales.totalPago + Number.EPSILON) * 100) / 100,
          },
        },
      ],
    });
  };

  const empresaOptions = empresas.map((e) => ({
    value: e.noCia,
    label: `${e.companyLabel} (${e.noCia})`,
  }));

  return (
    <ModulePage wide className="max-w-none">
      <ModulePageHeader
        title="Revisión de planilla"
        description="Valide planillas conforme se calculan en NAF (estado Calculada / En proceso). Totales de ingresos, deducciones y formas de pago; al final la suma de todas debe cuadrar con el líquido."
        icon={ClipboardCheck}
        actions={
          lastSync?.finishedAt ? (
            <span className="text-xs text-muted-foreground">
              Última sync nómina: {formatDateTime(lastSync.finishedAt)}
            </span>
          ) : null
        }
      />

      <div className="flex flex-col xl:flex-row flex-wrap gap-3 items-stretch xl:items-center">
        <MultiSelect
          options={empresaOptions}
          value={selectedEmpresas}
          onChange={handleEmpresasChange}
          placeholder="Empresas"
          className="w-full xl:w-[280px]"
        />

        <div className="flex items-center gap-1">
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
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[260px] max-w-[420px]"
            value={selectedRango ? rangoKey(selectedRango) : ""}
            onChange={(e) => {
              const value = e.target.value;
              const p = periodos.find((period) => rangoKey(period) === value);
              if (!p) return;
              setSelectedRango({ ano: p.ano, fDesde: p.fDesde, fHasta: p.fHasta });
              setSelectedPlanillas([]);
            }}
            disabled={selectedEmpresas.length === 0}
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

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar empresa o planilla…"
            className="pl-9"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>

        {canSync && (
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            title="Trae planillas abiertas/calculadas desde Oracle (RPL3071)"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", syncMutation.isPending && "animate-spin")} />
            {syncMutation.isPending ? "Sincronizando…" : "Sincronizar NAF"}
          </Button>
        )}
        <Button variant="outline" onClick={exportTable} disabled={visibleRows.length === 0}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel
        </Button>
      </div>

      {syncMutation.isError && (
        <p className="text-sm text-red-600">
          {(syncMutation.error as Error)?.message ?? "No se pudo sincronizar desde NAF."}
        </p>
      )}
      {checklistMutation.isError && (
        <p className="text-sm text-red-600">
          {(checklistMutation.error as Error)?.message ?? "No se pudo guardar el check de la planilla."}
        </p>
      )}
      {(aprobarMutation.isError || prepararMutation.isError || marcarPagadaMutation.isError) && (
        <p className="text-sm text-red-600">
          {(aprobarMutation.error as Error)?.message ||
            (prepararMutation.error as Error)?.message ||
            (marcarPagadaMutation.error as Error)?.message ||
            "Error en acción NAF de planilla."}
        </p>
      )}
      {(aprobarMutation.isSuccess || prepararMutation.isSuccess || marcarPagadaMutation.isSuccess) && (
        <p className="text-sm text-emerald-700">
          {prepararMutation.isSuccess
            ? "Pagos preparados en NAF (ARPLCK) y lote listo para descargar archivos."
            : aprobarMutation.isSuccess
              ? "Planilla aprobada en NAF (IND_CK_ACT=S)."
              : "Planilla marcada como pagada."}
        </p>
      )}
      {selectedRangoMeta && (
        <p className="text-sm text-slate-600">
          Quincena {formatDate(selectedRangoMeta.fDesde)} – {formatDate(selectedRangoMeta.fHasta)}
          {selectedEmpresas.length > 1
            ? ` · ${selectedRangoMeta.empresas}/${selectedEmpresas.length} empresas con datos en este rango`
            : ""}
          {selectedRangoMeta.descri ? ` · ${selectedRangoMeta.descri}` : ""}
          {detalleFetching ? " · Actualizando…" : ""}
        </p>
      )}

      {totales && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Metric label="Ingresos" value={formatCurrency(totales.ingresos)} />
          <Metric label="Deducciones" value={formatCurrency(totales.deducciones)} />
          <Metric label="Líquido" value={formatCurrency(totales.liquido)} />
          <Metric label="Davivienda" value={formatCurrency(totales.davivienda)} />
          <Metric label="BN" value={formatCurrency(totales.bn)} />
          <Metric
            label="Dif. total"
            value={formatCurrency(totales.diferencia)}
            accent={Math.abs(totales.diferencia) > 0.5 ? "text-red-600" : "text-emerald-700"}
          />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b bg-slate-50 text-sm">
            <div className="font-medium">Por empresa y planilla</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Fijas: Empresa / Cód. / Planilla. Acciones NAF: Aprobar (IND_CK_ACT) → Preparar (ARPLCK) →
              Check de pagado en cada columna CK/DAV/BN. Dif. = líquido − (CK + DAV + BN + otro).
            </div>
          </div>
          <div className="overflow-auto max-h-[calc(100vh-360px)]">
            <table
              data-table-id="naf-revision-planilla"
              className="w-full text-sm min-w-[1680px] border-separate border-spacing-0"
            >
              <thead className="sticky top-0 z-10 bg-slate-50">
              <TableColumnFilterHead
                tableId="naf-revision-planilla"
                columns={columnDefs}
                rows={filteredBySearch}
                filters={columnFilters}
                onFilterChange={(key, value) =>
                  setColumnFilters((prev) => ({ ...prev, [key]: value }))
                }
                defaultColumnWidths={{
                  companyLabel: STICKY_COLS.companyLabel.width,
                  codPla: STICKY_COLS.codPla.width,
                  nominaNombre: STICKY_COLS.nominaNombre.width,
                  estado: 100,
                  empleados: 88,
                  ingresos: 120,
                  deducciones: 120,
                  liquido: 120,
                  cheque: 130,
                  davivienda: 130,
                  bn: 130,
                  otro: 100,
                  sumaFormasPago: 120,
                  diferencia: 110,
                  accionesNaf: 220,
                  revisada: 88,
                  generada: 88,
                }}
              />
              </thead>
              <tbody>
                {detalleLoading && visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={columnDefs.length} className="p-6 text-center text-muted-foreground">
                      Cargando revisión…
                    </td>
                  </tr>
                )}
                {!detalleLoading && selectedEmpresas.length === 0 && (
                  <tr>
                    <td colSpan={columnDefs.length} className="p-6 text-center text-muted-foreground">
                      Seleccione empresas y un periodo de planilla para revisar.
                    </td>
                  </tr>
                )}
                {!detalleLoading &&
                  selectedEmpresas.length > 0 &&
                  selectedRango &&
                  visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={columnDefs.length} className="p-6 text-center text-muted-foreground">
                        Sin datos de planilla para el filtro actual.
                      </td>
                    </tr>
                  )}
                {visibleRows.map((row) => (
                  <tr
                    key={`${row.noCia}|${row.codPla}`}
                    className="group border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td
                      className={cn(stickyCellClass("companyLabel"), "p-3 whitespace-nowrap")}
                      style={stickyStyle("companyLabel")}
                      title={row.companyLabel}
                    >
                      {row.companyLabel}
                    </td>
                    <td
                      className={cn(stickyCellClass("codPla"), "p-3 whitespace-nowrap font-mono text-xs")}
                      style={stickyStyle("codPla")}
                    >
                      {row.codPla}
                    </td>
                    <td
                      className={cn(stickyCellClass("nominaNombre"), "p-3 whitespace-nowrap")}
                      style={stickyStyle("nominaNombre")}
                    >
                      {row.nominaNombre ?? "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          row.estado === "C" && "text-emerald-700",
                          row.estado === "M" && "text-amber-700",
                          !row.estado && "text-slate-500",
                        )}
                      >
                        {row.estadoLabel ?? "Cerrada"}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{row.empleados}</td>
                    <td className="p-3 text-right">
                      <AmountButton
                        value={row.ingresos}
                        onClick={() =>
                          setDetailTarget({
                            noCia: row.noCia,
                            codPla: row.codPla,
                            companyLabel: row.companyLabel,
                            nominaNombre: row.nominaNombre,
                          })
                        }
                      />
                    </td>
                    <td className="p-3 text-right">
                      <AmountButton
                        value={row.deducciones}
                        onClick={() =>
                          setDetailTarget({
                            noCia: row.noCia,
                            codPla: row.codPla,
                            companyLabel: row.companyLabel,
                            nominaNombre: row.nominaNombre,
                          })
                        }
                      />
                    </td>
                    <td className="p-3 text-right font-medium">
                      <AmountButton
                        value={row.liquido}
                        className="font-medium"
                        onClick={() =>
                          setDetailTarget({
                            noCia: row.noCia,
                            codPla: row.codPla,
                            companyLabel: row.companyLabel,
                            nominaNombre: row.nominaNombre,
                          })
                        }
                      />
                    </td>
                    {(
                      [
                        { canal: "CK" as const, field: "pagadaCk" as const, monto: row.cheque, title: "cheque" },
                        { canal: "DAV" as const, field: "pagadaDav" as const, monto: row.davivienda, title: "Davivienda" },
                        { canal: "BN" as const, field: "pagadaBn" as const, monto: row.bn, title: "Banco Nacional" },
                      ] as const
                    ).map(({ canal, field, monto, title }) => (
                      <td key={field} className="p-2">
                        <div className="flex items-center justify-end gap-2">
                          <AmountButton
                            value={monto}
                            disabled={monto <= 0}
                            title={`Ver empleados pagados por ${title}`}
                            onClick={() => openPagoReporte(row, canal)}
                          />
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 accent-[var(--app-primary)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                            checked={monto > 0 && row[field]}
                            disabled={
                              !canEditChecklist ||
                              checklistMutation.isPending ||
                              actionBusy ||
                              monto <= 0
                            }
                            title={
                              monto <= 0
                                ? `Sin monto ${canal}`
                                : canEditChecklist
                                  ? `Marcar ${canal} pagado`
                                  : "Sin permiso para editar checklist"
                            }
                            onChange={(e) => {
                              checklistMutation.mutate({
                                noCia: row.noCia,
                                codPla: row.codPla,
                                field,
                                value: e.target.checked,
                              });
                            }}
                          />
                        </div>
                      </td>
                    ))}
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.otro)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(row.sumaFormasPago)}</td>
                    <td
                      className={cn(
                        "p-3 text-right tabular-nums font-medium",
                        Math.abs(row.diferencia) > 0.5 ? "text-red-600" : "text-emerald-700",
                      )}
                    >
                      {formatCurrency(row.diferencia)}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-col gap-1 min-w-[200px]">
                        <div className="flex flex-wrap gap-1 justify-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={!canEditChecklist || actionBusy || row.revisada}
                            title="Aprobar nómina en NAF (IND_CK_ACT=S)"
                            onClick={() => {
                              if (!window.confirm(`¿Aprobar planilla ${row.codPla} de ${row.companyLabel} en NAF?`)) return;
                              aprobarMutation.mutate(row);
                            }}
                          >
                            <CheckSquare className="h-3.5 w-3.5 mr-1" />
                            Aprobar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={!canEditChecklist || actionBusy || !row.revisada}
                            title="Preparar cheques/transferencias (INSERT ARPLCK)"
                            onClick={() => {
                              if (row.generada) {
                                if (!window.confirm("Ya está generada. ¿Regenerar lote en NAF (ARPLCK)?")) return;
                                prepararMutation.mutate({ row, replaceExisting: true });
                                return;
                              }
                              if (!window.confirm(`¿Preparar cheques/transferencias de ${row.codPla} en NAF?`)) return;
                              prepararMutation.mutate({ row, replaceExisting: false });
                            }}
                          >
                            Preparar
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-center">
                          {(["BN", "DAV", "CK"] as const).map((canal) => (
                            <Button
                              key={canal}
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-1.5 text-xs"
                              disabled={!row.generada || actionBusy}
                              title={`Descargar archivo ${canal}`}
                              onClick={() => {
                                downloadArchivo(row, canal).catch((err) =>
                                  window.alert(err instanceof Error ? err.message : String(err)),
                                );
                              }}
                            >
                              <Download className="h-3.5 w-3.5 mr-0.5" />
                              {canal}
                            </Button>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-1.5 text-xs"
                            disabled={!canEditChecklist || actionBusy || !row.generada || row.pagada}
                            title="Marca pagado en CK, DAV y BN"
                            onClick={() => marcarPagadaMutation.mutate(row)}
                          >
                            Todo pagado
                          </Button>
                        </div>
                      </div>
                    </td>
                    {(["revisada", "generada"] as const).map((field) => (
                      <td key={field} className="p-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--app-primary)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          checked={row[field]}
                          disabled={!canEditChecklist || checklistMutation.isPending || actionBusy}
                          title={
                            canEditChecklist
                              ? `Marcar ${field}`
                              : "Sin permiso para editar checklist"
                          }
                          onChange={(e) => {
                            checklistMutation.mutate({
                              noCia: row.noCia,
                              codPla: row.codPla,
                              field,
                              value: e.target.checked,
                            });
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {visibleRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-slate-50 font-semibold">
                    <td
                      className={cn(stickyCellClass("companyLabel"), "!bg-slate-50 p-3")}
                      style={stickyStyle("companyLabel")}
                      colSpan={1}
                    >
                      Totales
                    </td>
                    <td
                      className={cn(stickyCellClass("codPla"), "!bg-slate-50 p-3")}
                      style={stickyStyle("codPla")}
                    />
                    <td
                      className={cn(stickyCellClass("nominaNombre"), "!bg-slate-50 p-3 text-xs font-medium")}
                      style={stickyStyle("nominaNombre")}
                    >
                      ({visibleRows.length} planillas)
                    </td>
                    <td className="p-3" />
                    <td className="p-3 text-right tabular-nums">{visibleTotales.empleados}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(visibleTotales.ingresos)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {formatCurrency(visibleTotales.deducciones)}
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(visibleTotales.liquido)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(visibleTotales.cheque)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {formatCurrency(visibleTotales.davivienda)}
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(visibleTotales.bn)}</td>
                    <td className="p-3 text-right tabular-nums">{formatCurrency(visibleTotales.otro)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {formatCurrency(visibleTotales.sumaFormasPago)}
                    </td>
                    <td
                      className={cn(
                        "p-3 text-right tabular-nums",
                        Math.abs(visibleTotales.diferencia) > 0.5 ? "text-red-600" : "text-emerald-700",
                      )}
                    >
                      {formatCurrency(visibleTotales.diferencia)}
                    </td>
                    <td className="p-3" />
                    <td className="p-3 text-center text-xs font-normal text-muted-foreground">
                      {visibleRows.filter((r) => r.revisada).length}
                    </td>
                    <td className="p-3 text-center text-xs font-normal text-muted-foreground">
                      {visibleRows.filter((r) => r.generada).length}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {visibleRows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b bg-slate-50 text-sm">
              <div className="font-medium">Resumen de pago por empresa y banco</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Suma de todas las nóminas visibles de cada empresa. Indica cuánto dinero necesita por
                canal (CK / Davivienda / BN) para el pago de la quincena.
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm" data-table-id="naf-revision-pago-empresa">
                <thead className="bg-slate-50">
                  <tr className="border-b text-left">
                    <th className="p-3 font-medium whitespace-nowrap">Empresa</th>
                    <th className="p-3 font-medium whitespace-nowrap text-right">Nóminas</th>
                    <th className="p-3 font-medium whitespace-nowrap text-right">Cheque (CK)</th>
                    <th className="p-3 font-medium whitespace-nowrap text-right">Davivienda</th>
                    <th className="p-3 font-medium whitespace-nowrap text-right">BN</th>
                    <th className="p-3 font-medium whitespace-nowrap text-right">Otro</th>
                    <th className="p-3 font-medium whitespace-nowrap text-right">Total a pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenPagoPorEmpresa.map((row) => (
                    <tr key={row.noCia} className="border-b hover:bg-slate-50/80">
                      <td className="p-3">
                        <div className="font-medium">{row.companyLabel}</div>
                        <div className="text-xs text-muted-foreground">NO_CIA {row.noCia}</div>
                      </td>
                      <td className="p-3 text-right tabular-nums">{row.planillas}</td>
                      <td className="p-3 text-right tabular-nums">{formatCurrency(row.cheque)}</td>
                      <td className="p-3 text-right tabular-nums">{formatCurrency(row.davivienda)}</td>
                      <td className="p-3 text-right tabular-nums">{formatCurrency(row.bn)}</td>
                      <td className="p-3 text-right tabular-nums">{formatCurrency(row.otro)}</td>
                      <td className="p-3 text-right tabular-nums font-semibold">
                        {formatCurrency(row.totalPago)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-slate-50 font-semibold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right tabular-nums">{resumenPagoTotales.planillas}</td>
                    <td className="p-3 text-right tabular-nums">
                      {formatCurrency(resumenPagoTotales.cheque)}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatCurrency(resumenPagoTotales.davivienda)}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatCurrency(resumenPagoTotales.bn)}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatCurrency(resumenPagoTotales.otro)}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatCurrency(resumenPagoTotales.totalPago)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(detailTarget)} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {detailTarget
                ? `${detailTarget.companyLabel} · ${detailTarget.codPla}${
                    detailTarget.nominaNombre ? ` · ${detailTarget.nominaNombre}` : ""
                  }`
                : "Detalle de planilla"}
            </DialogTitle>
            <DialogDescription>
              {selectedRango
                ? `Quincena ${formatDate(selectedRango.fDesde)} – ${formatDate(selectedRango.fHasta)}`
                : ""}
              {planillaDetalle?.estadoLabel ? ` · ${planillaDetalle.estadoLabel}` : ""}
              {planillaDetalle?.fuente === "abierta" ? " · En vivo NAF" : planillaDetalle ? " · Histórico NAF" : ""}
            </DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando rubros…
            </div>
          )}
          {detailError && (
            <p className="text-sm text-red-600 py-6">
              {(detailErr as Error)?.message ?? "No se pudo cargar el detalle."}
            </p>
          )}
          {planillaDetalle && !detailLoading && (
            <div className="overflow-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-semibold mb-2 border-b pb-1">Ingresos</div>
                  <table className="w-full text-sm" data-table-id="naf-revision-ingresos">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1 pr-2">Cód.</th>
                        <th className="py-1 pr-2">Descripción</th>
                        <th className="py-1 text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planillaDetalle.ingresos.map((line) => (
                        <tr key={`I-${line.codigo}`} className="border-b border-slate-100">
                          <td className="py-1.5 pr-2 font-mono text-xs whitespace-nowrap">{line.codigo}</td>
                          <td className="py-1.5 pr-2">{line.descripcion}</td>
                          <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                            {formatCurrency(line.monto)}
                          </td>
                        </tr>
                      ))}
                      {planillaDetalle.ingresos.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-muted-foreground">
                            Sin ingresos
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold border-t">
                        <td className="py-2" colSpan={2}>
                          Total ingresos
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCurrency(planillaDetalle.totales.ingresos)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div>
                  <div className="text-sm font-semibold mb-2 border-b pb-1">Deducciones</div>
                  <table className="w-full text-sm" data-table-id="naf-revision-deducciones">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1 pr-2">Cód.</th>
                        <th className="py-1 pr-2">Descripción</th>
                        <th className="py-1 text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planillaDetalle.deducciones.map((line) => (
                        <tr key={`D-${line.codigo}`} className="border-b border-slate-100">
                          <td className="py-1.5 pr-2 font-mono text-xs whitespace-nowrap">{line.codigo}</td>
                          <td className="py-1.5 pr-2">{line.descripcion}</td>
                          <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                            {formatCurrency(line.monto)}
                          </td>
                        </tr>
                      ))}
                      {planillaDetalle.deducciones.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-muted-foreground">
                            Sin deducciones
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold border-t">
                        <td className="py-2" colSpan={2}>
                          Total deducciones
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCurrency(planillaDetalle.totales.deducciones)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="rounded-md bg-slate-50 border px-4 py-3 flex flex-wrap gap-6 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Total ingresos</div>
                  <div className="font-semibold tabular-nums">
                    {formatCurrency(planillaDetalle.totales.ingresos)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total deducciones</div>
                  <div className="font-semibold tabular-nums">
                    {formatCurrency(planillaDetalle.totales.deducciones)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Líquido pagable</div>
                  <div className="font-semibold tabular-nums text-emerald-700">
                    {formatCurrency(planillaDetalle.totales.liquido)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pagoTarget)} onOpenChange={(open) => !open && setPagoTarget(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col print:max-w-none print:max-h-none">
          <DialogHeader>
            <DialogTitle>
              {pagoTarget
                ? `${pagoTarget.companyLabel} · ${canalTitulo(pagoTarget.canal)}`
                : "Empleados por forma de pago"}
            </DialogTitle>
            <DialogDescription>
              {pagoTarget
                ? `Planilla ${pagoTarget.codPla}${
                    pagoTarget.nominaNombre ? ` · ${pagoTarget.nominaNombre}` : ""
                  }`
                : ""}
              {selectedRango
                ? ` · Quincena ${formatDate(selectedRango.fDesde)} – ${formatDate(selectedRango.fHasta)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagoReporte || pagoReporte.empleados.length === 0}
              onClick={() => {
                if (!pagoReporte) return;
                exportRowsToExcel({
                  filename: `pago_${pagoReporte.canal.toLowerCase()}_${pagoReporte.noCia}_${pagoReporte.codPla}`,
                  sheetName: pagoReporte.canalLabel,
                  rows: pagoReporte.empleados.map((emp) => ({
                    "No. Emp.": emp.noEmple,
                    Nombre: emp.nombre ?? "",
                    Cédula: emp.cedula ?? "",
                    "F. Pago": emp.formaPago ?? "",
                    Banco: emp.banco ?? "",
                    Cuenta: emp.numCuenta ?? "",
                    "Salario neto": emp.liquido,
                  })),
                });
              }}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button
              size="sm"
              disabled={!pagoReporte || pagoReporte.empleados.length === 0}
              onClick={() => pagoReporte && printEmpleadosPagoReporte(pagoReporte)}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>

          {pagoLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando empleados…
            </div>
          )}
          {pagoError && (
            <p className="text-sm text-red-600 py-6">
              {(pagoErr as Error)?.message ?? "No se pudo cargar el listado."}
            </p>
          )}
          {pagoReporte && !pagoLoading && (
            <div className="overflow-auto">
              <table className="w-full text-sm" data-table-id="naf-revision-empleados-pago">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2">No. Emp.</th>
                    <th className="py-2 pr-2">Nombre</th>
                    <th className="py-2 pr-2">F. Pago</th>
                    <th className="py-2 pr-2">Banco</th>
                    <th className="py-2 pr-2">Cuenta</th>
                    <th className="py-2 text-right">Salario neto</th>
                  </tr>
                </thead>
                <tbody>
                  {pagoReporte.empleados.map((emp) => (
                    <tr key={emp.noEmple} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 font-mono text-xs whitespace-nowrap">{emp.noEmple}</td>
                      <td className="py-1.5 pr-2">{emp.nombre ?? "—"}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{emp.formaPago ?? "—"}</td>
                      <td className="py-1.5 pr-2">{emp.banco ?? "—"}</td>
                      <td className="py-1.5 pr-2 font-mono text-xs whitespace-nowrap">
                        {emp.numCuenta ?? "—"}
                      </td>
                      <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                        {formatCurrency(emp.liquido)}
                      </td>
                    </tr>
                  ))}
                  {pagoReporte.empleados.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        No hay empleados con este medio de pago en la planilla.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t-2">
                    <td className="py-2" colSpan={5}>
                      TOTAL GENERAL ({pagoReporte.totales.empleados} empleados)
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(pagoReporte.totales.liquido)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModulePage>
  );
}
