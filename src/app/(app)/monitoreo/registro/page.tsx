"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  TableColumnFilterHead,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { Card, CardContent } from "@/components/ui/card";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";

type ActivacionRow = {
  id: string;
  activatedAt: string;
  alarmNumber: number;
  finca: string;
  zona: string;
  motorizado: string | null;
  operadorName: string;
  estado: string | null;
  tipoActivacion: string | null;
};

export default function BandecoRegistroPage() {
  const { data, isLoading } = useQuery<{ data: ActivacionRow[] }>({
    queryKey: ["monitoreo-activaciones"],
    queryFn: () => fetch("/api/monitoreo/activaciones?limit=500").then((r) => r.json()),
  });

  const rows = data?.data ?? [];
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const columnDefs: TableColumnFilterDef<ActivacionRow>[] = [
    { key: "fecha", label: "Fecha/Hora", headerClassName: "px-4 py-2", getValue: (r) => r.activatedAt },
    { key: "codigo", label: "Código", headerClassName: "px-4 py-2", getValue: (r) => String(r.alarmNumber) },
    { key: "finca", label: "Finca", headerClassName: "px-4 py-2", getValue: (r) => r.finca },
    { key: "zona", label: "Zona", headerClassName: "px-4 py-2", getValue: (r) => r.zona },
    { key: "motorizado", label: "Motorizado", headerClassName: "px-4 py-2", getValue: (r) => r.motorizado ?? "" },
    { key: "operador", label: "Operador", headerClassName: "px-4 py-2", getValue: (r) => r.operadorName },
    { key: "tipo", label: "Tipo", headerClassName: "px-4 py-2", getValue: (r) => r.tipoActivacion ?? "" },
  ];
  const displayedRows = filterRowsByColumnFilters(rows, columnFilters, columnDefs);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Registro de activaciones</h1>
          <p className="text-sm text-slate-500">Historial equivalente a la hoja REGISTRO ({rows.length} registros).</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          disabled={displayedRows.length === 0}
          onClick={() =>
            exportRowsToExcel({
              filename: `bandeco-registro-${new Date().toISOString().slice(0, 10)}`,
              sheetName: "Registro",
              rows: displayedRows.map((r) => ({
                Fecha: new Date(r.activatedAt).toLocaleString("es-CR"),
                Código: r.alarmNumber,
                Finca: r.finca,
                Zona: r.zona,
                Motorizado: r.motorizado ?? "",
                Operador: r.operadorName,
                Estado: r.estado ?? "",
                Tipo: r.tipoActivacion ?? "normal",
              })),
            })
          }
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <p className="p-8 text-center text-slate-400">Cargando...</p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-slate-400">Sin registros aún.</p>
          ) : (
            <table data-table-id="monitoreo-registro" className="w-full text-sm">
              <thead>
                <TableColumnFilterHead
                  tableId="monitoreo-registro"
                  defaultColumnWidths={{
                    fecha: 110,
                    codigo: 120,
                    finca: 180,
                    zona: 120,
                    motorizado: 160,
                    operador: 160,
                    tipo: 120,
                  }}
                  columns={columnDefs}
                  rows={rows}
                  filters={columnFilters}
                  onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                />
              </thead>
              <tbody>
                {displayedRows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-slate-50/50">
                    <td className="px-4 py-2 whitespace-nowrap">
                      {new Date(r.activatedAt).toLocaleString("es-CR")}
                    </td>
                    <td className="px-4 py-2 font-mono">{r.alarmNumber}</td>
                    <td className="px-4 py-2">{r.finca}</td>
                    <td className="px-4 py-2">{r.zona}</td>
                    <td className="px-4 py-2">{r.motorizado}</td>
                    <td className="px-4 py-2">{r.operadorName}</td>
                    <td className="px-4 py-2 capitalize">{r.tipoActivacion ?? "normal"}</td>
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
