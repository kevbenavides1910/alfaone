"use client";

import { useQuery } from "@tanstack/react-query";
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
                <tr className="border-b bg-slate-50 text-left text-slate-600">
                  <th className="px-4 py-2">Finca</th>
                  <th className="px-4 py-2">Desmane</th>
                  <th className="px-4 py-2">Paneo</th>
                  <th className="px-4 py-2">Zona / Motorizado</th>
                  <th className="px-4 py-2">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
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
