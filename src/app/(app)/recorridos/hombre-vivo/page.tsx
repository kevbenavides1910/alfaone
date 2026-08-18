"use client";

import { useMemo, useState } from "react";
import { TableColumnFilterHead, type TableColumnFilterDef } from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { useQuery } from "@tanstack/react-query";
import { HeartPulse, Search, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";
import { exportRowsToExcel } from "@/lib/utils/excel-export";

type WelfareHistoryResponse = {
  data: {
    periodo: { desde: string; hasta: string };
    totales: {
      total: number;
      confirmados: number;
      pendientes: number;
      noRespondidos: number;
      manuales: number;
      programados: number;
    };
    filas: {
      id: string;
      scheduledAt: string;
      acknowledgedAt: string | null;
      imei: string;
      employeeCode: string | null;
      routeCode: string;
      routeName: string;
      source: string;
      sourceLabel: string;
      status: string;
      statusLabel: string;
    }[];
  };
};

const STATUS_BADGE: Record<string, string> = {
  ACK: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-900",
  MISSED: "bg-red-100 text-red-800",
};

function todayIsoCostaRica() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function HombreVivoHistorialPage() {
  const [desde, setDesde] = useState(todayIsoCostaRica());
  const [hasta, setHasta] = useState(todayIsoCostaRica());
  const [imei, setImei] = useState("");
  const [status, setStatus] = useState("");
  const [queryDesde, setQueryDesde] = useState(desde);
  const [queryHasta, setQueryHasta] = useState(hasta);
  const [queryImei, setQueryImei] = useState("");
  const [queryStatus, setQueryStatus] = useState("");

  const queryKey = useMemo(
    () => ["patrol-welfare-history", queryDesde, queryHasta, queryImei, queryStatus],
    [queryDesde, queryHasta, queryImei, queryStatus],
  );

  const { data, isLoading, isFetching, refetch } = useQuery<WelfareHistoryResponse>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ desde: queryDesde, hasta: queryHasta });
      if (queryImei) params.set("imei", queryImei);
      if (queryStatus) params.set("status", queryStatus);
      return fetch(`/api/admin/patrol/reports/welfare-history?${params}`).then((r) => r.json());
    },
  });

  const filas = data?.data.filas ?? [];
  const totales = data?.data.totales;
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  type Row = NonNullable<WelfareHistoryResponse["data"]>["filas"][number];
  const columnDefs: TableColumnFilterDef<Row>[] = [
    { key: "programada", label: "Programada", headerClassName: "py-2 pr-3", getValue: (r) => r.scheduledAt },
    { key: "confirmada", label: "Confirmada", headerClassName: "py-2 pr-3", getValue: (r) => r.acknowledgedAt ?? "" },
    { key: "ruta", label: "Ruta", headerClassName: "py-2 pr-3", getValue: (r) => r.routeCode ?? r.routeName ?? "" },
    { key: "imei", label: "IMEI", headerClassName: "py-2 pr-3", getValue: (r) => r.imei },
    { key: "empleado", label: "Empleado", headerClassName: "py-2 pr-3", getValue: (r) => r.employeeCode ?? "" },
    { key: "origen", label: "Origen", headerClassName: "py-2 pr-3", getValue: (r) => r.sourceLabel ?? r.source ?? "" },
    { key: "estado", label: "Estado", headerClassName: "py-2", getValue: (r) => r.statusLabel ?? r.status ?? "" },
  ];
  const displayedRows = filterRowsByColumnFilters(filas, columnFilters, columnDefs);

  function runSearch() {
    setQueryDesde(desde);
    setQueryHasta(hasta);
    setQueryImei(imei.trim());
    setQueryStatus(status);
  }

  function handleExport() {
    if (displayedRows.length === 0) return;
    exportRowsToExcel({
      filename: "recorridos_hombre_vivo",
      sheetName: "Historial",
      rows: displayedRows.map((f) => ({
        Programada: formatDateTime(f.scheduledAt),
        Confirmada: f.acknowledgedAt ? formatDateTime(f.acknowledgedAt) : "",
        Ruta: f.routeCode,
        "Nombre ruta": f.routeName,
        IMEI: f.imei,
        Empleado: f.employeeCode ?? "",
        Origen: f.sourceLabel,
        Estado: f.statusLabel,
      })),
      columnWidths: [18, 18, 12, 24, 18, 12, 12, 14],
    });
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <HeartPulse className="h-7 w-7" />
          Historial hombre vivo
        </h1>
        <p className="text-muted-foreground mt-1">
          Alertas programadas y manuales, con estado de confirmación del guardia.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Desde</label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Hasta</label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">IMEI</label>
            <Input
              value={imei}
              onChange={(e) => setImei(e.target.value)}
              placeholder="Opcional"
              className="w-52"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Estado</label>
            <select
              className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="ACK">Confirmado</option>
              <option value="PENDING">Pendiente</option>
              <option value="MISSED">No respondido</option>
            </select>
          </div>
          <Button onClick={runSearch} disabled={isFetching}>
            <Search className="h-4 w-4 mr-2" />
            Consultar
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            Actualizar
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={displayedRows.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </CardContent>
      </Card>

      {totales && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{totales.total}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-emerald-700">{totales.confirmados}</p><p className="text-xs text-muted-foreground">Confirmados</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-amber-700">{totales.pendientes}</p><p className="text-xs text-muted-foreground">Pendientes</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-red-700">{totales.noRespondidos}</p><p className="text-xs text-muted-foreground">No respondidos</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{totales.manuales}</p><p className="text-xs text-muted-foreground">Manuales</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{totales.programados}</p><p className="text-xs text-muted-foreground">Programados</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros ({filas.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : filas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros en el período.</p>
          ) : (
            <table data-table-id="recorridos-hombre-vivo" className="w-full text-sm">
              <thead>
                <TableColumnFilterHead
                  tableId="recorridos-hombre-vivo"
                  defaultColumnWidths={{
                    programada: 110,
                    confirmada: 110,
                    ruta: 160,
                    imei: 160,
                    empleado: 180,
                    origen: 120,
                    estado: 100,
                  }}
                  columns={columnDefs}
                  rows={filas}
                  filters={columnFilters}
                  onFilterChange={(k, v) => {
                    setColumnFilters((s) => ({ ...s, [k]: v }));
                    if (k === "imei") {
                      setQueryImei(v);
                      setImei(v);
                    } else if (k === "estado") {
                      setQueryStatus(v);
                      setStatus(v);
                    }
                  }}
                />
              </thead>
              <tbody>
                {displayedRows.map((f) => (
                  <tr key={f.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(f.scheduledAt)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {f.acknowledgedAt ? formatDateTime(f.acknowledgedAt) : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-mono">{f.routeCode}</span>
                      <span className="text-muted-foreground"> — {f.routeName}</span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{f.imei}</td>
                    <td className="py-2 pr-3">{f.employeeCode ?? "—"}</td>
                    <td className="py-2 pr-3">{f.sourceLabel}</td>
                    <td className="py-2">
                      <Badge className={STATUS_BADGE[f.status] ?? ""}>{f.statusLabel}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
