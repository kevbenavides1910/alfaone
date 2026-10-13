"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Compromiso = {
  id: string;
  tema: string;
  subtipo: string | null;
  obligacion: string;
  frecuencia: string;
  meses: number | null;
  pagina: number | null;
  documento: string | null;
  citasAdicionales: number;
  proximaFecha: string | null;
  numeroDeVez: number | null;
};

type Respuesta = {
  licitacionNo: string;
  inicio: string | null;
  fin: string | null;
  total: number;
  conProximaFecha: number;
  compromisos: Compromiso[];
};

const TEMAS_CLAVE = ["Uniformes y dotación", "Capacitación y adiestramiento", "Polígono, armas y tiro",
  "Salud ocupacional y exámenes", "Equipos, CCTV y radios", "Informes y reportes", "Pólizas y garantías"];

function fecha(iso: string | null) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Compromisos periódicos que exige el cartel/pliego, con la cita y la próxima fecha exigible. */
export function CommitmentsTab({ contractId }: { contractId: string }) {
  const [tema, setTema] = useState<string>("");
  const { data, isLoading } = useQuery<Respuesta>({
    queryKey: ["contract-commitments", contractId],
    queryFn: () => fetch(`/api/contracts/${contractId}/commitments`).then((r) => r.json()),
  });

  const temas = useMemo(() => {
    const s = new Set<string>();
    (data?.compromisos ?? []).forEach((c) => s.add(c.tema));
    return Array.from(s).sort();
  }, [data]);

  const filas = useMemo(() => {
    const lista = data?.compromisos ?? [];
    return tema ? lista.filter((c) => c.tema === tema) : lista;
  }, [data, tema]);

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4" />
          Compromisos periódicos del cartel/pliego
        </CardTitle>
        <p className="text-xs text-[#525252]">
          {data ? (
            <>
              {data.total} compromisos detectados ({data.conProximaFecha} con fecha exigible calculada desde el inicio
              del contrato{data.inicio ? ` (${fecha(data.inicio)})` : ""}). Cada fila cita el pliego y la página, para
              que se pueda verificar el texto original.
            </>
          ) : (
            "Cargando…"
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            className="h-8 rounded-sm border border-[#c6c6c6] bg-white px-2 text-xs"
          >
            <option value="">Todos los temas</option>
            {temas.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {TEMAS_CLAVE.filter((t) => temas.includes(t)).length > 0 && (
            <span className="text-[11px] text-[#525252]">
              Atajos: {TEMAS_CLAVE.filter((t) => temas.includes(t)).map((t) => (
                <button key={t} onClick={() => setTema(t)} className="ml-1 text-red-700 hover:underline">{t}</button>
              ))}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-[#525252]">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando compromisos…
          </div>
        ) : filas.length === 0 ? (
          <div className="rounded-sm border border-dashed border-[#c6c6c6] p-6 text-center text-sm text-[#525252]">
            {data?.total ? "No hay compromisos de ese tema en este contrato." : "Este contrato no tiene compromisos cargados. Se cargan a partir del cartel/pliego del expediente."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#f4f4f4] text-left text-[11px] uppercase tracking-wide text-[#525252]">
                  <th className="border-b border-[#e0e0e0] px-2 py-2">Próxima fecha</th>
                  <th className="border-b border-[#e0e0e0] px-2 py-2">Tema</th>
                  <th className="border-b border-[#e0e0e0] px-2 py-2">Compromiso (texto del pliego)</th>
                  <th className="border-b border-[#e0e0e0] px-2 py-2">Frecuencia</th>
                  <th className="border-b border-[#e0e0e0] px-2 py-2">Pág.</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-[#fafafa]">
                    <td className="whitespace-nowrap border-b border-[#f0f0f0] px-2 py-2 font-medium">
                      {c.proximaFecha ? (
                        <>
                          {fecha(c.proximaFecha)}
                          {c.numeroDeVez ? <span className="block text-[10px] font-normal text-[#8d8d8d]">vez {c.numeroDeVez}</span> : null}
                        </>
                      ) : (
                        <span className="text-[#8d8d8d]">sin fecha</span>
                      )}
                    </td>
                    <td className="border-b border-[#f0f0f0] px-2 py-2">
                      {c.tema}
                      {c.subtipo ? <span className="block text-[10px] text-[#8d8d8d]">{c.subtipo}</span> : null}
                    </td>
                    <td className="border-b border-[#f0f0f0] px-2 py-2 text-[#161616]">
                      {c.obligacion}
                      {c.citasAdicionales > 0 ? (
                        <span className="block text-[10px] text-[#8d8d8d]">{c.citasAdicionales} citas más en el mismo pliego</span>
                      ) : null}
                    </td>
                    <td className="border-b border-[#f0f0f0] px-2 py-2">
                      {c.frecuencia}
                      {c.meses ? <span className="block text-[10px] text-[#8d8d8d]">cada {c.meses} mes(es)</span> : null}
                    </td>
                    <td className="border-b border-[#f0f0f0] px-2 py-2 text-center">
                      <span className="inline-flex items-center gap-1 text-[#525252]">
                        <FileText className="h-3 w-3" />
                        {c.pagina ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
