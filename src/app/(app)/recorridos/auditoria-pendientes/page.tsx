"use client";

import { useMemo, useState } from "react";
import { TableColumnFilterHead, type TableColumnFilterDef } from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Search, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";

type AuditResponse = {
  data: {
    imei: string;
    range: { desde: string; hasta: string };
    snapshotAt: string | null;
    pendingCount: number;
    staleCount: number;
    missingCount: number;
    serverMarkCount: number;
    missingOnServer: {
      localId?: number;
      type: string;
      tag?: string;
      markType?: string;
      timestamp?: string;
      status?: string;
    }[];
    serverMarks: {
      id: string;
      markType: string;
      nfcTagCode: string | null;
      markedAt: string;
      employeeCode: string | null;
    }[];
  };
};

function defaultRange() {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - 7);
  return {
    desde: desde.toISOString().slice(0, 10),
    hasta: hasta.toISOString().slice(0, 10),
  };
}

export default function AuditoriaPendientesPage() {
  const initial = useMemo(() => defaultRange(), []);
  const [imei, setImei] = useState("");
  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);
  const [queryImei, setQueryImei] = useState("");

  const { data, isFetching, refetch, error } = useQuery<AuditResponse>({
    queryKey: ["device-pending-audit", queryImei, desde, hasta],
    enabled: queryImei.length >= 8,
    queryFn: () => {
      const params = new URLSearchParams({ imei: queryImei, desde, hasta });
      return fetch(`/api/admin/patrol/reports/device-pending-audit?${params}`).then((r) => r.json());
    },
  });

  const report = data?.data;

  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  type MissingRow = NonNullable<AuditResponse["data"]>["missingOnServer"][number];
  const missingColumnDefs: TableColumnFilterDef<MissingRow>[] = [
    { key: "localId", label: "ID local", headerClassName: "py-2 pr-4", getValue: (r) => r.localId ?? "" },
    { key: "type", label: "Tipo", headerClassName: "py-2 pr-4", getValue: (r) => r.type ?? r.markType ?? "" },
    { key: "tag", label: "Tag / Tipo marca", headerClassName: "py-2 pr-4", getValue: (r) => r.tag ?? r.markType ?? "" },
    { key: "fecha", label: "Fecha", headerClassName: "py-2 pr-4", getValue: (r) => r.timestamp ?? "" },
    { key: "estado", label: "Estado", headerClassName: "py-2", getValue: (r) => r.status ?? "" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Smartphone className="h-7 w-7" />
          Auditoría marcas pendientes (IMEI)
        </h1>
        <p className="text-muted-foreground mt-1">
          Compara el último snapshot del teléfono con las marcas recibidas en servidor.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">IMEI</label>
            <Input value={imei} onChange={(e) => setImei(e.target.value)} placeholder="865965073355974" className="w-56" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Desde</label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Hasta</label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Button
            onClick={() => setQueryImei(imei.trim())}
            disabled={imei.trim().length < 8 || isFetching}
          >
            <Search className="h-4 w-4 mr-2" />
            Consultar
          </Button>
          {queryImei && (
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              Actualizar
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-destructive">Error al cargar auditoría.</CardContent>
        </Card>
      )}

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Pendientes en teléfono</div>
                <div className="text-2xl font-bold">{report.pendingCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Antiguas (&gt;24h)</div>
                <div className="text-2xl font-bold text-amber-600">{report.staleCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">En servidor</div>
                <div className="text-2xl font-bold text-green-700">{report.serverMarkCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Sin llegar al servidor</div>
                <div className="text-2xl font-bold text-red-600">{report.missingCount}</div>
              </CardContent>
            </Card>
          </div>

          {report.snapshotAt && (
            <p className="text-sm text-muted-foreground">
              Último snapshot del dispositivo: {formatDateTime(report.snapshotAt)}
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Marcas en teléfono no encontradas en servidor ({report.missingOnServer.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table data-table-id="recorridos-auditoria-pendientes" className="w-full text-sm">
              <thead>
                <TableColumnFilterHead
                  tableId="recorridos-auditoria-pendientes"
                  defaultColumnWidths={{
                    localId: 140,
                    type: 120,
                    tag: 140,
                    fecha: 110,
                    estado: 100,
                  }}
                  columns={missingColumnDefs}
                  rows={report.missingOnServer}
                  filters={columnFilters}
                  onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                />
              </thead>
              <tbody>
                {report.missingOnServer.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-muted-foreground">
                        No hay discrepancias en el rango seleccionado.
                      </td>
                    </tr>
                  ) : (
                    report.missingOnServer.map((row, i) => (
                      <tr key={`${row.localId}-${i}`} className="border-b border-muted/40">
                        <td className="py-2 pr-4">{row.localId ?? "—"}</td>
                        <td className="py-2 pr-4">{row.type}</td>
                        <td className="py-2 pr-4">{row.tag ?? row.markType ?? "—"}</td>
                        <td className="py-2 pr-4">{row.timestamp ?? "—"}</td>
                        <td className="py-2">
                          <Badge variant="outline">{row.status ?? "PEN"}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
