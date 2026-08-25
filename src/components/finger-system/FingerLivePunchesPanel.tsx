"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FingerCompanyFilterHint } from "@/components/finger-system/FingerCompanyFilterHint";
import { fingerApiUrl, useFingerCompany } from "@/components/finger-system/finger-company-context";

type LivePunch = {
  id: string;
  checkTime: string;
  badgeNumber: string | null;
  checkType: string | null;
  verifyCode: number | null;
  deviceSn: string | null;
  employeeName: string | null;
  employeeCodigo: string | null;
};

const MAX_ROWS = 80;

export function FingerLivePunchesPanel() {
  const { companyCode } = useFingerCompany();
  const [punches, setPunches] = useState<LivePunch[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const seenIds = useRef(new Set<string>());

  const bootstrapQuery = useQuery<{ data: { items: LivePunch[] } }>({
    queryKey: ["finger-punches-recent", companyCode],
    queryFn: async () => {
      const res = await fetch(
        fingerApiUrl("/api/finger-system/punches/recent?limit=30", companyCode),
        { credentials: "same-origin" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar marcas");
      return json;
    },
  });

  useEffect(() => {
    setPunches([]);
    seenIds.current.clear();
    setLastUpdate(null);
    setConnected(false);
  }, [companyCode]);

  useEffect(() => {
    const items = bootstrapQuery.data?.data.items ?? [];
    if (items.length === 0) return;
    setPunches(items);
    for (const p of items) seenIds.current.add(p.id);
    setLastUpdate(new Date().toISOString());
  }, [bootstrapQuery.data]);

  useEffect(() => {
    const es = new EventSource(fingerApiUrl("/api/finger-system/punches/stream", companyCode));

    es.addEventListener("connected", () => setConnected(true));
    es.addEventListener("initial", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { items: LivePunch[] };
        if (data.items?.length) {
          setPunches((prev) => {
            const merged = [...data.items];
            for (const p of prev) {
              if (!merged.some((m) => m.id === p.id)) merged.push(p);
            }
            merged.sort((a, b) => b.checkTime.localeCompare(a.checkTime));
            return merged.slice(0, MAX_ROWS);
          });
          for (const p of data.items) seenIds.current.add(p.id);
          setLastUpdate(new Date().toISOString());
        }
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("punches", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { items: LivePunch[] };
        const fresh = data.items.filter((p) => !seenIds.current.has(p.id));
        if (fresh.length === 0) return;
        for (const p of fresh) seenIds.current.add(p.id);
        setPunches((prev) => [...fresh.reverse(), ...prev].slice(0, MAX_ROWS));
        setLastUpdate(new Date().toISOString());
      } catch {
        /* ignore */
      }
    });
    es.onerror = () => setConnected(false);

    return () => es.close();
  }, [companyCode]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Marcas en vivo</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Actualización automática cada 10 s desde marcas importadas en PostgreSQL.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FingerCompanyFilterHint />
          <Badge className={connected ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}>
            {connected ? "En vivo" : "Reconectando…"}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => bootstrapQuery.refetch()}>
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {bootstrapQuery.isError ? (
          <p className="text-sm text-red-600">{(bootstrapQuery.error as Error).message}</p>
        ) : null}
        {lastUpdate ? (
          <p className="text-xs text-slate-500 mb-3">
            Última actualización: {new Date(lastUpdate).toLocaleString("es-CR")}
          </p>
        ) : null}
        <div className="overflow-auto rounded-lg border max-h-[28rem]">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Hora</th>
                <th className="px-3 py-2 text-left font-medium">Empleado</th>
                <th className="px-3 py-2 text-left font-medium">Badge</th>
                <th className="px-3 py-2 text-left font-medium">Tipo</th>
                <th className="px-3 py-2 text-left font-medium">Dispositivo</th>
              </tr>
            </thead>
            <tbody>
              {punches.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(row.checkTime).toLocaleString("es-CR")}
                  </td>
                  <td className="px-3 py-2">
                    {row.employeeName ?? "—"}
                    {row.employeeCodigo ? (
                      <span className="text-xs text-slate-400 ml-1">({row.employeeCodigo})</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono">{row.badgeNumber ?? "—"}</td>
                  <td className="px-3 py-2">{row.checkType ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.deviceSn ?? "—"}</td>
                </tr>
              ))}
              {punches.length === 0 && !bootstrapQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    Sin marcas recientes para esta empresa. Importe marcas desde Asistencia o ATT2016.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
