"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileSpreadsheet, XCircle, FileText, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { formatDateTime } from "@/lib/utils/format";
import type { ReportMarkPoint } from "@/components/recorridos/PatrolMarksMap";

const PatrolMarksMap = dynamic(
  () => import("@/components/recorridos/PatrolMarksMap").then((m) => m.PatrolMarksMap),
  { ssr: false, loading: () => <div className="h-[420px] rounded-lg bg-muted/30 animate-pulse" /> },
);

type SummaryResponse = {
  data: {
    totals: {
      devicesTotal: number;
      devicesActive: number;
      routesTotal: number;
      routesActive: number;
      pointsTotal: number;
      assignmentsToday: number;
    };
    recentDevices: {
      imei: string;
      employeeCode: string;
      label: string | null;
      isActive: boolean;
      lastLoginAt: string | null;
    }[];
  };
};

type ComplianceResponse = {
  data: {
    periodo: { desde: string; hasta: string };
    totales: {
      esperadas: number;
      realizadas: number;
      justificadas: number;
      noRealizadas: number;
      pctCumplimiento: number;
    };
    filas: {
      fecha: string;
      omissionKey: string;
      deviceId: string;
      routeId: string;
      routePointId: string;
      deviceLabel: string | null;
      imei: string;
      employeeCode: string;
      employeeName: string | null;
      contractName: string | null;
      zoneName: string | null;
      routeCode: string;
      routeName: string;
      pointLabel: string;
      pointCode: string;
      nfcTagCode: string;
      ventanaInicio: string;
      ventanaFin: string;
      horarioProgramado: string;
      estado: "REALIZADA" | "NO_REALIZADA";
      markedAt: string | null;
      latitude: number | null;
      longitude: number | null;
      markId: string | null;
      justification: {
        id: string;
        description: string;
        source: string;
        imagePath: string | null;
      } | null;
    }[];
    recentMarks: {
      imei: string;
      nfcTagCode: string | null;
      employeeCode: string | null;
      markedAt: string;
      fechaCr: string;
    }[];
  };
};

type ComplianceFila = ComplianceResponse["data"]["filas"][number];

type DisplayEstado = "REALIZADA" | "JUSTIFICADA" | "NO_REALIZADA";

function todayIsoCostaRica() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function yesterdayIsoCostaRica() {
  const today = todayIsoCostaRica();
  const [y, m, d] = today.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}

function toDateTimeLocal(fecha: string, hora: string): string {
  return `${fecha}T${hora}`;
}

function splitDateTimeLocal(value: string): { fecha: string; hora: string } {
  const [fecha, hora = "00:00"] = value.split("T");
  return { fecha, hora: hora.slice(0, 5) };
}

/** Hora Costa Rica (UTC-6 fijo) → ms UTC para comparar rangos. */
function costaRicaDateTimeMs(fecha: string, hhmm: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return Date.UTC(y, m - 1, d, h + 6, min, 0, 0);
}

function rowScheduledWindowMs(f: ComplianceFila): { start: number; end: number } {
  const start = costaRicaDateTimeMs(f.fecha, f.ventanaInicio);
  let end = costaRicaDateTimeMs(f.fecha, f.ventanaFin);
  if (end < start) end += 24 * 60 * 60 * 1000;
  end += 59 * 1000;
  return { start, end };
}

function displayEstado(f: ComplianceFila): DisplayEstado {
  if (f.estado === "REALIZADA") return "REALIZADA";
  if (f.justification) return "JUSTIFICADA";
  return "NO_REALIZADA";
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.map((v) => v?.trim() || "").filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

const SELECT_CLASS =
  "mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const EMPTY_FILTERS = {
  estado: "",
  zona: "",
  contrato: "",
  oficial: "",
  ruta: "",
  horario: "",
};

export default function RecorridosReportesPage() {
  const qc = useQueryClient();
  const today = todayIsoCostaRica();
  const [desdeDateTime, setDesdeDateTime] = useState(toDateTimeLocal(today, "00:00"));
  const [hastaDateTime, setHastaDateTime] = useState(toDateTimeLocal(today, "23:59"));
  const [imei, setImei] = useState("");
  const [columnFilters, setColumnFilters] = useState({ ...EMPTY_FILTERS });
  const [justifyOpen, setJustifyOpen] = useState(false);
  const [justifyRow, setJustifyRow] = useState<ComplianceFila | null>(null);
  const [justifyDesc, setJustifyDesc] = useState("");
  const [justifyImage, setJustifyImage] = useState<string | null>(null);
  const [justifyImageMime, setJustifyImageMime] = useState<string | null>(null);
  const [justifyImageName, setJustifyImageName] = useState<string | null>(null);
  const [selectedOmissionKeys, setSelectedOmissionKeys] = useState<string[]>([]);

  const { data: summary, isLoading: loadingSummary } = useQuery<SummaryResponse>({
    queryKey: ["patrol-summary"],
    queryFn: () => fetch("/api/admin/patrol/reports/summary").then((r) => r.json()),
  });

  const queryDesde = splitDateTimeLocal(desdeDateTime).fecha;
  const queryHasta = splitDateTimeLocal(hastaDateTime).fecha;

  const complianceQueryKey = useMemo(
    () => ["patrol-marks-compliance", queryDesde, queryHasta, imei.trim()],
    [queryDesde, queryHasta, imei],
  );

  const { data: compliance, isLoading: loadingCompliance, refetch, isFetching } =
    useQuery<ComplianceResponse>({
      queryKey: complianceQueryKey,
      queryFn: () => {
        const params = new URLSearchParams({ desde: queryDesde, hasta: queryHasta });
        if (imei.trim()) params.set("imei", imei.trim());
        return fetch(`/api/admin/patrol/reports/marcas?${params}`).then((r) => r.json());
      },
      enabled: Boolean(queryDesde && queryHasta),
    });

  const allFilas = compliance?.data.filas ?? [];
  const recentMarks = compliance?.data.recentMarks ?? [];

  const filterRangeMs = useMemo(() => {
    const d = splitDateTimeLocal(desdeDateTime);
    const h = splitDateTimeLocal(hastaDateTime);
    return {
      start: costaRicaDateTimeMs(d.fecha, d.hora),
      end: costaRicaDateTimeMs(h.fecha, h.hora),
    };
  }, [desdeDateTime, hastaDateTime]);

  const filterOptions = useMemo(() => {
    const base = allFilas.filter((f) => {
      const w = rowScheduledWindowMs(f);
      return w.start <= filterRangeMs.end && w.end >= filterRangeMs.start;
    });
    return {
      zonas: uniqueSorted(base.map((f) => f.zoneName)),
      contratos: uniqueSorted(base.map((f) => f.contractName)),
      oficiales: [...base]
        .sort((a, b) =>
          (a.employeeName ?? a.employeeCode).localeCompare(b.employeeName ?? b.employeeCode, "es"),
        )
        .reduce<{ code: string; label: string }[]>((acc, f) => {
          if (acc.some((o) => o.code === f.employeeCode)) return acc;
          acc.push({
            code: f.employeeCode,
            label: f.employeeName ? `${f.employeeName} (${f.employeeCode})` : f.employeeCode,
          });
          return acc;
        }, []),
      rutas: [...base]
        .sort((a, b) => a.routeName.localeCompare(b.routeName, "es"))
        .reduce<{ id: string; label: string }[]>((acc, f) => {
          if (acc.some((r) => r.id === f.routeId)) return acc;
          acc.push({ id: f.routeId, label: `${f.routeCode} · ${f.routeName}` });
          return acc;
        }, []),
      horarios: uniqueSorted(base.map((f) => f.horarioProgramado)),
    };
  }, [allFilas, filterRangeMs]);

  const filas = useMemo(() => {
    return allFilas.filter((f) => {
      const w = rowScheduledWindowMs(f);
      if (w.start > filterRangeMs.end || w.end < filterRangeMs.start) return false;

      if (columnFilters.estado && displayEstado(f) !== columnFilters.estado) return false;
      if (columnFilters.zona && (f.zoneName?.trim() || "") !== columnFilters.zona) return false;
      if (columnFilters.contrato && (f.contractName?.trim() || "") !== columnFilters.contrato) {
        return false;
      }
      if (columnFilters.oficial && f.employeeCode !== columnFilters.oficial) return false;
      if (columnFilters.ruta && f.routeId !== columnFilters.ruta) return false;
      if (columnFilters.horario && f.horarioProgramado !== columnFilters.horario) return false;

      return true;
    });
  }, [allFilas, filterRangeMs, columnFilters]);

  const markTotals = useMemo(() => {
    const esperadas = filas.length;
    const realizadas = filas.filter((f) => f.estado === "REALIZADA").length;
    const justificadas = filas.filter(
      (f) => f.estado === "NO_REALIZADA" && f.justification,
    ).length;
    const noRealizadas = esperadas - realizadas - justificadas;
    const pctCumplimiento =
      esperadas > 0 ? Math.round(((realizadas + justificadas) / esperadas) * 100) : 0;
    return { esperadas, realizadas, justificadas, noRealizadas, pctCumplimiento };
  }, [filas]);

  const mapMarks = useMemo((): ReportMarkPoint[] => {
    return filas
      .filter(
        (f) =>
          f.latitude != null &&
          f.longitude != null &&
          Math.abs(f.latitude) > 0.0001 &&
          Math.abs(f.longitude) > 0.0001,
      )
      .map((f) => ({
        id: f.omissionKey,
        label: f.pointLabel,
        routeName: f.routeName,
        pointLabel: f.pointLabel,
        nfcTagCode: f.nfcTagCode,
        estado: f.estado,
        markedAt: f.markedAt,
        latitude: f.latitude!,
        longitude: f.longitude!,
      }));
  }, [filas]);

  const hasActiveColumnFilters = Object.values(columnFilters).some(Boolean);
  const hasTimeNarrowing =
    splitDateTimeLocal(desdeDateTime).hora !== "00:00" ||
    splitDateTimeLocal(hastaDateTime).hora !== "23:59" ||
    queryDesde !== queryHasta;

  const relatedOmissions = useMemo(() => {
    if (!justifyRow) return [];
    return allFilas.filter(
      (f) =>
        f.estado === "NO_REALIZADA" &&
        !f.justification &&
        f.fecha === justifyRow.fecha &&
        f.deviceId === justifyRow.deviceId &&
        f.routeId === justifyRow.routeId,
    );
  }, [allFilas, justifyRow]);

  const justifyMutation = useMutation({
    mutationFn: async () => {
      if (!justifyRow || selectedOmissionKeys.length === 0) return;
      const omissions = relatedOmissions
        .filter((f) => selectedOmissionKeys.includes(f.omissionKey))
        .map((f) => ({
          omissionKey: f.omissionKey,
          fecha: f.fecha,
          deviceId: f.deviceId,
          routeId: f.routeId,
          routePointId: f.routePointId,
          routeCode: f.routeCode,
          pointLabel: f.pointLabel,
          nfcTagCode: f.nfcTagCode,
        }));
      const res = await fetch("/api/admin/patrol/justifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          omissions,
          description: justifyDesc,
          imageBase64: justifyImage,
          imageMimeType: justifyImageMime,
          imageFileName: justifyImageName,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Error al justificar");
      }
      return omissions.length;
    },
    onSuccess: (count) => {
      toast.success(
        count && count > 1
          ? `${count} omisiones justificadas`
          : "Omisión justificada",
      );
      setJustifyOpen(false);
      setJustifyRow(null);
      setJustifyDesc("");
      setJustifyImage(null);
      setSelectedOmissionKeys([]);
      qc.invalidateQueries({ queryKey: complianceQueryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openJustify(row: ComplianceFila) {
    setJustifyRow(row);
    setJustifyDesc("");
    setJustifyImage(null);
    setJustifyImageMime(null);
    setJustifyImageName(null);
    const related = allFilas.filter(
      (f) =>
        f.estado === "NO_REALIZADA" &&
        !f.justification &&
        f.fecha === row.fecha &&
        f.deviceId === row.deviceId &&
        f.routeId === row.routeId,
    );
    setSelectedOmissionKeys(related.map((f) => f.omissionKey));
    setJustifyOpen(true);
  }

  function toggleOmissionKey(key: string, checked: boolean) {
    setSelectedOmissionKeys((prev) =>
      checked ? [...new Set([...prev, key])] : prev.filter((k) => k !== key),
    );
  }

  function onPhotoSelected(file: File | null) {
    if (!file) {
      setJustifyImage(null);
      setJustifyImageMime(null);
      setJustifyImageName(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setJustifyImage(result);
      setJustifyImageMime(file.type || "image/jpeg");
      setJustifyImageName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function exportDevices() {
    const rows = (summary?.data.recentDevices ?? []).map((d) => ({
      Empleado: d.employeeCode,
      IMEI: d.imei,
      Etiqueta: d.label ?? "",
      Activo: d.isActive ? "Si" : "No",
      "Ultimo login": d.lastLoginAt ? formatDateTime(d.lastLoginAt) : "",
    }));
    exportRowsToExcel({
      filename: "syntra_dispositivos",
      sheetName: "Dispositivos",
      rows,
      columnWidths: [12, 18, 24, 8, 20],
    });
  }

  function exportMarcas() {
    const rows = filas.map((f) => ({
      Fecha: f.fecha,
      Contrato: f.contractName ?? "",
      Zona: f.zoneName ?? "",
      Oficial: f.employeeName ?? f.employeeCode,
      Codigo: f.employeeCode,
      IMEI: f.imei,
      Ruta: `${f.routeCode} - ${f.routeName}`,
      Punto: f.pointLabel,
      Tag: f.nfcTagCode,
      HorarioProgramado: f.horarioProgramado,
      VentanaInicio: f.ventanaInicio,
      VentanaFin: f.ventanaFin,
      Estado:
        f.estado === "REALIZADA"
          ? "Realizada"
          : f.justification
            ? "Justificada"
            : "No realizada",
      Justificacion: f.justification?.description ?? "",
      "Marca registrada": f.markedAt ? formatDateTime(f.markedAt) : "",
      Latitud: f.latitude ?? "",
      Longitud: f.longitude ?? "",
    }));
    exportRowsToExcel({
      filename: `syntra_marcas_${queryDesde}_${queryHasta}`,
      sheetName: "Marcas",
      rows,
      columnWidths: [12, 24, 14, 22, 10, 18, 28, 24, 10, 16, 10, 10, 14, 28, 20, 12, 12],
    });
  }

  const totals = summary?.data.totals;
  const marksOnOtherDays =
    recentMarks.length > 0 &&
    markTotals.realizadas === 0 &&
    recentMarks.some((m) => m.fechaCr < queryDesde || m.fechaCr > queryHasta);

  function setPeriodo(fecha: string) {
    setDesdeDateTime(toDateTimeLocal(fecha, "00:00"));
    setHastaDateTime(toDateTimeLocal(fecha, "23:59"));
    setColumnFilters({ ...EMPTY_FILTERS });
  }

  function clearColumnFilters() {
    setColumnFilters({ ...EMPTY_FILTERS });
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl font-bold">Reportes operativos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cumplimiento de rondas NFC registradas desde la app SYNTRA.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marcas realizadas y no realizadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Las marcas se agrupan por fecha en Costa Rica. Si marcó anoche, pruebe con la fecha de ayer.
          </p>
          {marksOnOtherDays ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Hay marcas registradas en otras fechas. Última: {recentMarks[0]?.fechaCr} tag{" "}
              {recentMarks[0]?.nfcTagCode}.{" "}
              <button
                type="button"
                className="underline font-medium"
                onClick={() => {
                  const f = recentMarks[0]?.fechaCr;
                  if (f) setPeriodo(f);
                }}
              >
                Ver fecha {recentMarks[0]?.fechaCr}
              </button>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground">Desde (fecha y hora)</label>
              <Input
                type="datetime-local"
                value={desdeDateTime}
                onChange={(e) => setDesdeDateTime(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hasta (fecha y hora)</label>
              <Input
                type="datetime-local"
                value={hastaDateTime}
                onChange={(e) => setHastaDateTime(e.target.value)}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs text-muted-foreground">IMEI (opcional)</label>
              <Input
                placeholder="000000000000001"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Filtros adicionales</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div>
                <label className="text-xs text-muted-foreground">Estado</label>
                <select
                  className={SELECT_CLASS}
                  value={columnFilters.estado}
                  onChange={(e) => setColumnFilters((p) => ({ ...p, estado: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="REALIZADA">Realizada</option>
                  <option value="JUSTIFICADA">Justificada</option>
                  <option value="NO_REALIZADA">No realizada</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Zona</label>
                <select
                  className={SELECT_CLASS}
                  value={columnFilters.zona}
                  onChange={(e) => setColumnFilters((p) => ({ ...p, zona: e.target.value }))}
                >
                  <option value="">Todas</option>
                  {filterOptions.zonas.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Contrato</label>
                <select
                  className={SELECT_CLASS}
                  value={columnFilters.contrato}
                  onChange={(e) => setColumnFilters((p) => ({ ...p, contrato: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {filterOptions.contratos.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Oficial</label>
                <select
                  className={SELECT_CLASS}
                  value={columnFilters.oficial}
                  onChange={(e) => setColumnFilters((p) => ({ ...p, oficial: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {filterOptions.oficiales.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ruta</label>
                <select
                  className={SELECT_CLASS}
                  value={columnFilters.ruta}
                  onChange={(e) => setColumnFilters((p) => ({ ...p, ruta: e.target.value }))}
                >
                  <option value="">Todas</option>
                  {filterOptions.rutas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Horario programado</label>
                <select
                  className={SELECT_CLASS}
                  value={columnFilters.horario}
                  onChange={(e) => setColumnFilters((p) => ({ ...p, horario: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {filterOptions.horarios.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Consultando..." : "Consultar marcas"}
            </Button>
            <Button variant="outline" onClick={() => setPeriodo(yesterdayIsoCostaRica())}>
              Ayer (CR)
            </Button>
            <Button variant="outline" onClick={() => setPeriodo(todayIsoCostaRica())}>
              Hoy (CR)
            </Button>
            {hasActiveColumnFilters ? (
              <Button variant="ghost" size="sm" onClick={clearColumnFilters}>
                Limpiar filtros
              </Button>
            ) : null}
            <Button variant="outline" onClick={exportMarcas} disabled={!filas.length}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar marcas (Excel)
            </Button>
            {!loadingCompliance && allFilas.length > 0 ? (
              <span className="text-xs text-muted-foreground ml-auto">
                Mostrando {filas.length} de {allFilas.length} registros
                {hasTimeNarrowing || hasActiveColumnFilters ? " (filtrados)" : ""}
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-5 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Esperadas</p>
              <p className="text-2xl font-semibold">{loadingCompliance ? "…" : markTotals.esperadas}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Realizadas</p>
              <p className="text-2xl font-semibold text-green-700">
                {loadingCompliance ? "…" : markTotals.realizadas}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Justificadas</p>
              <p className="text-2xl font-semibold text-amber-700">
                {loadingCompliance ? "…" : markTotals.justificadas}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">No realizadas</p>
              <p className="text-2xl font-semibold text-red-700">
                {loadingCompliance ? "…" : markTotals.noRealizadas}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Cumplimiento</p>
              <p className="text-2xl font-semibold">{loadingCompliance ? "…" : `${markTotals.pctCumplimiento}%`}</p>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Mapa de marcas ({mapMarks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PatrolMarksMap marks={mapMarks} />
              <p className="text-xs text-muted-foreground mt-2">
                Verde: realizada · Rojo: no realizada (sin coordenadas GPS no aparece en el mapa).
              </p>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Contrato</th>
                  <th className="px-3 py-2 text-left">Zona</th>
                  <th className="px-3 py-2 text-left">Oficial</th>
                  <th className="px-3 py-2 text-left">Ruta / Punto</th>
                  <th className="px-3 py-2 text-left">Horario prog.</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">Hora marca</th>
                  <th className="px-3 py-2 text-left">GPS</th>
                  <th className="px-3 py-2 text-left">Acción</th>
                </tr>
              </thead>
              <tbody>
                {loadingCompliance ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                      Cargando reporte...
                    </td>
                  </tr>
                ) : filas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                      {allFilas.length > 0
                        ? "Ningún registro coincide con los filtros aplicados."
                        : "No hay puntos asignados o marcas en el periodo seleccionado."}
                    </td>
                  </tr>
                ) : (
                  filas.map((f) => (
                    <tr key={f.omissionKey} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{f.fecha}</td>
                      <td className="px-3 py-2 max-w-[160px]">
                        <div className="truncate" title={f.contractName ?? undefined}>
                          {f.contractName ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{f.zoneName ?? "—"}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{f.employeeName ?? f.employeeCode}</div>
                        {f.employeeName ? (
                          <div className="text-xs text-muted-foreground">{f.employeeCode}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{f.routeName}</div>
                        <div className="text-muted-foreground">
                          {f.pointLabel} · tag {f.nfcTagCode}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium">
                        {f.horarioProgramado}
                      </td>
                      <td className="px-3 py-2">
                        {f.estado === "REALIZADA" ? (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <CheckCircle2 className="h-4 w-4" /> Realizada
                          </span>
                        ) : f.justification ? (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <FileText className="h-4 w-4" /> Justificada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <XCircle className="h-4 w-4" /> No realizada
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {f.markedAt ? formatDateTime(f.markedAt) : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {f.latitude != null && f.longitude != null ? (
                          <a
                            href={`https://www.google.com/maps?q=${f.latitude},${f.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            {f.latitude.toFixed(5)}, {f.longitude.toFixed(5)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {f.estado === "NO_REALIZADA" && !f.justification ? (
                          <Button size="sm" variant="outline" onClick={() => openJustify(f)}>
                            Justificar
                          </Button>
                        ) : f.justification?.imagePath ? (
                          <a
                            href={f.justification.imagePath}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary underline"
                          >
                            Ver adjunto
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={justifyOpen} onOpenChange={setJustifyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Justificar omisión</DialogTitle>
          </DialogHeader>
          {justifyRow ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {justifyRow.fecha} · {justifyRow.routeName} · dispositivo {justifyRow.deviceId}
              </p>
              {relatedOmissions.length > 0 ? (
                <div>
                  <Label className="mb-2 block">
                    Omisiones a justificar ({selectedOmissionKeys.length} de {relatedOmissions.length})
                  </Label>
                  <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                    {relatedOmissions.map((f) => {
                      const checked = selectedOmissionKeys.includes(f.omissionKey);
                      return (
                        <label
                          key={f.omissionKey}
                          className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleOmissionKey(f.omissionKey, e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border"
                          />
                          <span className="text-sm leading-snug">
                            <span className="font-medium">{f.pointLabel}</span>
                            <span className="text-muted-foreground"> · {f.horarioProgramado}</span>
                            <span className="text-muted-foreground"> · tag {f.nfcTagCode}</span>
                            {f.omissionKey === justifyRow.omissionKey ? (
                              <span className="text-muted-foreground"> (actual)</span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Misma ruta y puesto en la fecha seleccionada. Desmarque las que no apliquen al mismo incidente.
                  </p>
                </div>
              ) : null}
              <div>
                <Label>Causa / descripción</Label>
                <textarea
                  className="mt-1 w-full min-h-[100px] rounded-md border px-3 py-2 text-sm bg-background"
                  value={justifyDesc}
                  onChange={(e) => setJustifyDesc(e.target.value)}
                  placeholder="Describa por qué no se realizó la marca…"
                />
              </div>
              <div>
                <Label>Foto (opcional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  className="mt-1"
                  onChange={(e) => onPhotoSelected(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setJustifyOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => justifyMutation.mutate()}
              disabled={
                justifyDesc.trim().length < 3 ||
                selectedOmissionKeys.length === 0 ||
                justifyMutation.isPending
              }
            >
              Guardar justificación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen actual</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Dispositivos activos: {loadingSummary ? "…" : `${totals?.devicesActive}/${totals?.devicesTotal}`}</p>
            <p>Rutas activas: {loadingSummary ? "…" : `${totals?.routesActive}/${totals?.routesTotal}`}</p>
            <p>Puntos NFC configurados: {loadingSummary ? "…" : totals?.pointsTotal}</p>
            <p>Asignaciones vigentes hoy: {loadingSummary ? "…" : totals?.assignmentsToday}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exportar</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={exportDevices} disabled={!summary?.data.recentDevices.length}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Dispositivos y ultimo acceso (Excel)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
