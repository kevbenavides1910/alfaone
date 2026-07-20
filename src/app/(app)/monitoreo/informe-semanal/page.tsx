"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyTextButton } from "@/components/monitoreo/CopyTextButton";

function weekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export default function BandecoInformeSemanalPage() {
  const [desde, setDesde] = useState(weekAgo());
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10));
  const [fetchKey, setFetchKey] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ data: { texto: string } }>({
    queryKey: ["monitoreo-informe-semanal", fetchKey],
    queryFn: () =>
      fetch(`/api/monitoreo/informe-semanal?desde=${desde}&hasta=${hasta}`).then((r) => r.json()),
    enabled: fetchKey != null,
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Informe semanal</h1>
        <p className="text-sm text-slate-500">
          Consolida activaciones del período — equivalente a INFORME SEMANAL del Excel.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-sm text-slate-600">Desde</label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm text-slate-600">Hasta</label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-1" />
          </div>
          <Button
            onClick={() => {
              setFetchKey(`${desde}-${hasta}`);
              void refetch();
            }}
          >
            Generar informe
          </Button>
        </CardContent>
      </Card>

      {isLoading && <p className="text-center text-slate-400">Generando...</p>}

      {data?.data?.texto && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Informe generado</CardTitle>
            <CopyTextButton text={data.data.texto} />
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap bg-slate-50 p-4 rounded-md max-h-[60vh] overflow-y-auto font-mono">
              {data.data.texto}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
