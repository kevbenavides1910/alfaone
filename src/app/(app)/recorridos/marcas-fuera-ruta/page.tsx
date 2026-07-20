"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileSpreadsheet, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { formatDateTime } from "@/lib/utils/format";
import { type TableColumnFilterDef, TableColumnFilterHead } from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";

type OutOfRouteResponse = {
  data: {
    periodo: { desde: string; hasta: string };
    totales: {
      fueraDeRuta: number;
      tagNoRegistrado: number;
      telefonoNoAsignado: number;
      fueraDeHorario: number;
      sinHorarioHoy: number;
    };
    filas: {
      markId: string;
      markedAt: string;
      fecha: string;
      imei: string;
      deviceLabel: string | null;
      employeeCode: string | null;
      employeeName: string | null;
      nfcTagCode: string | null;
      routeCode: string | null;
      routeName: string | null;
      pointLabel: string | null;
      pointCode: string | null;
      positionName: string | null;
      locationName: string | null;
      horarioProgramado: string | null;
      motivo: string;
      motivoLabel: string;
    }[];
  };
};

const MOTIVO_BADGE: Record<string, string> = {
  TAG_NO_REGISTRADO: "bg-slate-100 text-slate-700",
  TELEFONO_NO_ASIGNADO: "bg-orange-100 text-orange-800",
  FUERA_DE_HORARIO: "bg-amber-100 text-amber-900",
  SIN_HORARIO_HOY: "bg-purple-100 text-purple-800",
};

function todayIsoCostaRica() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function MarcasFueraRutaPage() {
  const [desde, setDesde] = useState(todayIsoCostaRica());
  const [hasta, setHasta] = useState(todayIsoCostaRica());
  const [imei, setImei] = useState("");
  const [queryDesde, setQueryDesde] = useState(desde);
  const [queryHasta, setQueryHasta] = useState(hasta);

  const queryKey = useMemo(
    () => ["patrol-out-of-route-marks", queryDesde, queryHasta, imei.trim()],
    [queryDesde, queryHasta, imei],
  );

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery<OutOfRouteResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ desde: queryDesde, hasta: queryHasta });
      if (imei.trim()) params.set("imei", imei.trim());
      const r = await fetch(`/api/admin/patrol/reports/marcas-fuera-ruta?${params}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar marcas fuera de ruta");
      return json;
    },
  });

  const filas = data?.data?.filas ?? [];
  const totales = data?.data?.totales;
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  type Row = NonNullable<OutOfRouteResponse["data"]>["filas"][number];
  const columnDefs: TableColumnFilterDef<Row>[] = [
    { key: "fecha", label: "Fecha / hora", headerClassName: "px-3 py-2 text-left", getValue: (r) => r.fecha },
    { key: "telefono", label: "Teléfono", headerClassName: "px-3 py-2 text-left", getValue: (r) => r.imei },
    { key: "empleado", label: "Empleado", headerClassName: "px-3 py-2 text-left", getValue: (r) => r.employeeName ?? r.employeeCode ?? "" },
    { key: "tag", label: "Tag NFC", headerClassName: "px-3 py-2 text-left", getValue: (r) => r.nfcTagCode ?? "" },
    { key: "ruta", label: "Ruta / punto", headerClassName: "px-3 py-2 text-left", getValue: (r) => r.routeCode ?? r.routeName ?? r.pointLabel ?? r.pointCode ?? "" },
    { key: "horario", label: "Horario prog.", headerClassName: "px-3 py-2 text-left", getValue: (r) => r.horarioProgramado ?? "" },
    { key: "motivo", label: "Motivo", headerClassName: "px-3 py-2 text-left", getValue: (r) => r.motivoLabel ?? r.motivo ?? "" },
  ];
  const displayedRows = filterRowsByColumnFilters(filas, columnFilters, columnDefs);

  function runSearch() {
    setQueryDesde(desde);
    setQueryHasta(hasta);
  }

  function exportExcel() {
    exportRowsToExcel({
      rows: filas.map((f) => ({
        Fecha: f.fecha,
        Hora: formatDateTime(f.markedAt),
        IMEI: f.imei,
        Empleado: f.employeeName ?? f.employeeCode ?? "",
        Tag: f.nfcTagCode ?? "",
        Ruta: f.routeCode ? `${f.routeCode} - ${f.routeName ?? ""}` : "",
        Punto: f.pointLabel ?? f.pointCode ?? "",
        Ubicacion: f.locationName ?? "",
        Horario_programado: f.horarioProgramado ?? "",
        Motivo: f.motivoLabel,
      })),
      filename: `alfa_one_marcas_fuera_ruta_${queryDesde}_${queryHasta}`,
      sheetName: "Fuera de ruta",
    });
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Marcas fuera de ruta
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Marcas NFC que no correspondían a ninguna ruta autorizada, horario o tag registrado.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Desde</label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1 w-40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Hasta</label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-1 w-40" />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="text-xs text-muted-foreground">IMEI (opcional)</label>
            <Input
              value={imei}
              onChange={(e) => setImei(e.target.value)}
              placeholder="Filtrar por IMEI"
              className="mt-1"
            />
          </div>
          <Button onClick={runSearch} disabled={isFetching}>
            <Search className="h-4 w-4 mr-2" />
            {isFetching ? "Consultando..." : "Consultar"}
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            Actualizar
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={!filas.length}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total fuera de ruta</p>
            <p className="text-2xl font-semibold">{isLoading ? "…" : totales?.fueraDeRuta ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Tag no registrado</p>
            <p className="text-2xl font-semibold">{isLoading ? "…" : totales?.tagNoRegistrado ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Teléfono no asignado</p>
            <p className="text-2xl font-semibold">{isLoading ? "…" : totales?.telefonoNoAsignado ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Fuera de horario</p>
            <p className="text-2xl font-semibold">{isLoading ? "…" : totales?.fueraDeHorario ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Sin horario hoy</p>
            <p className="text-2xl font-semibold">{isLoading ? "…" : totales?.sinHorarioHoy ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalle ({filas.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <TableColumnFilterHead
                columns={columnDefs}
                rows={filas}
                filters={columnFilters}
                onFilterChange={(k, v) => {
                  setColumnFilters((s) => ({ ...s, [k]: v }));
                  if (k === "telefono") {
                    setImei(v);
                    setQueryDesde(queryDesde);
                    setQueryHasta(queryHasta);
                  }
                }}
              />
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Cargando marcas...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-red-600 text-sm">
                    {(error as Error)?.message ?? "No se pudieron cargar las marcas fuera de ruta."}
                  </td>
                </tr>
              ) : filas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No hay marcas fuera de ruta en el periodo seleccionado.
                  </td>
                </tr>
              ) : (
                displayedRows.map((f) => (
                  <tr key={f.markId} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div>{f.fecha}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(f.markedAt)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs">{f.imei}</div>
                      {f.deviceLabel ? (
                        <div className="text-xs text-muted-foreground">{f.deviceLabel}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {f.employeeName ?? f.employeeCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{f.nfcTagCode ?? "—"}</td>
                    <td className="px-3 py-2">
                      {f.routeCode ? (
                        <>
                          <div>{f.routeCode} · {f.routeName}</div>
                          <div className="text-xs text-muted-foreground">
                            {f.pointLabel ?? f.pointCode}
                            {f.locationName ? ` · ${f.locationName}` : ""}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{f.horarioProgramado ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge className={MOTIVO_BADGE[f.motivo] ?? "bg-muted"}>{f.motivoLabel}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
