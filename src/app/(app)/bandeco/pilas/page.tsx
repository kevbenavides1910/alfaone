"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  TableColumnFilterHead,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyTextButton } from "@/components/bandeco/CopyTextButton";

type PilaRow = {
  id: string;
  finca: string;
  desmane: string | null;
  paneo: string | null;
  zonaMotorizado: string | null;
  observaciones: string | null;
};

export default function BandecoPilasPage() {
  const { data, isLoading } = useQuery<{ data: PilaRow[] }>({
    queryKey: ["bandeco-pilas"],
    queryFn: () => fetch("/api/bandeco/pilas-fincas").then((r) => r.json()),
  });

  const rows = data?.data ?? [];
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const columnDefs: TableColumnFilterDef<PilaRow>[] = [
    { key: "finca", label: "Finca", headerClassName: "px-4 py-2", getValue: (r) => r.finca },
    { key: "desmane", label: "Desmane", headerClassName: "px-4 py-2", getValue: (r) => r.desmane ?? "" },
    { key: "paneo", label: "Paneo", headerClassName: "px-4 py-2", getValue: (r) => r.paneo ?? "" },
    { key: "zona", label: "Zona / Motorizado", headerClassName: "px-4 py-2", getValue: (r) => r.zonaMotorizado ?? "" },
    { key: "obs", label: "Observaciones", headerClassName: "px-4 py-2", getValue: (r) => r.observaciones ?? "" },
  ];
  const displayedRows = filterRowsByColumnFilters(rows, columnFilters, columnDefs);

  const mensajePilas = [
    "REPORTE LLENADO DE PILAS ZONA BANDECO",
    "",
    ...rows.map((r) =>
      [
        `FINCA: ${r.finca}`,
        r.desmane ? `DESMANE: ${r.desmane}` : null,
        r.paneo ? `PANEO: ${r.paneo}` : null,
        r.zonaMotorizado ? `ZONA: ${r.zonaMotorizado}` : null,
        r.observaciones ? `OBS: ${r.observaciones}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    ),
  ].join("\n");

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Reporte de pilas</h1>
          <p className="text-sm text-slate-500">Equivalente a la hoja PILAS — estado por finca.</p>
        </div>
        <CopyTextButton text={mensajePilas} label="Copiar reporte completo" />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <p className="p-8 text-center text-slate-400">Cargando...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <TableColumnFilterHead
                  columns={columnDefs}
                  rows={rows}
                  filters={columnFilters}
                  onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                />
              </thead>
              <tbody>
                {displayedRows.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="px-4 py-2 font-medium">{r.finca}</td>
                    <td className="px-4 py-2">{r.desmane ?? "—"}</td>
                    <td className="px-4 py-2">{r.paneo ?? "—"}</td>
                    <td className="px-4 py-2">{r.zonaMotorizado ?? "—"}</td>
                    <td className="px-4 py-2">{r.observaciones ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensaje WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs whitespace-pre-wrap bg-slate-50 p-3 rounded-md max-h-60 overflow-y-auto">
            ⚠️ *A este x11 solicito reporte de pilas compañeros* ⚠️
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
