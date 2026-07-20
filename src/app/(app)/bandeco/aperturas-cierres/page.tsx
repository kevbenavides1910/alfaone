"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/client-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";

type AycRow = {
  id: string;
  finca: string;
  codigo: number;
  ubicacion: string;
  dia: string | null;
  fecha: string;
  horaApertura: string | null;
  horaCierre: string | null;
  operadorName: string;
  estado: string | null;
};

export default function BandecoAperturasCierresPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [horaApertura, setHoraApertura] = useState("");
  const [horaCierre, setHoraCierre] = useState("");

  const { data, isLoading } = useQuery<{ data: AycRow[] }>({
    queryKey: ["bandeco-ayc"],
    queryFn: () => fetch("/api/bandeco/aperturas-cierres").then((r) => r.json()),
  });

  const { data: pendientes } = useQuery<{ data: AycRow[] }>({
    queryKey: ["bandeco-ayc-pendientes"],
    queryFn: () => fetch("/api/bandeco/aperturas-cierres?pendientes=1").then((r) => r.json()),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/bandeco/aperturas-cierres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: Number(codigo),
          horaApertura: horaApertura || null,
          horaCierre: horaCierre || null,
          operadorName: session?.user?.name ?? "Operador",
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "Error");
      return json;
    },
    onSuccess: () => {
      toast.success("Apertura/cierre registrado");
      setCodigo("");
      setHoraApertura("");
      setHoraCierre("");
      void qc.invalidateQueries({ queryKey: ["bandeco-ayc"] });
      void qc.invalidateQueries({ queryKey: ["bandeco-ayc-pendientes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];
  const pend = pendientes?.data ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Aperturas y cierres</h1>
        <p className="text-sm text-slate-500">Equivalente a las hojas A Y C y APEYCE del Excel.</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Registrar apertura o cierre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="number"
            placeholder="Código de alarma"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Hora apertura (05:22)" value={horaApertura} onChange={(e) => setHoraApertura(e.target.value)} />
            <Input placeholder="Hora cierre (17:24)" value={horaCierre} onChange={(e) => setHoraCierre(e.target.value)} />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!codigo || mutation.isPending}>
            Guardar
          </Button>
        </CardContent>
      </Card>

      {pend.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-base text-amber-800">Cierres pendientes ({pend.length})</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {pend.map((p) => (
              <div key={p.id} className="flex gap-2">
                <span className="font-medium">{p.finca}</span>
                <span>{p.ubicacion}</span>
                <span className="text-amber-700">{p.estado}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <p className="p-8 text-center text-slate-400">Cargando...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-600">
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Finca</th>
                  <th className="px-4 py-2">Ubicación</th>
                  <th className="px-4 py-2">Apertura</th>
                  <th className="px-4 py-2">Cierre</th>
                  <th className="px-4 py-2">Operador</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="px-4 py-2">{new Date(r.fecha).toLocaleDateString("es-CR")}</td>
                    <td className="px-4 py-2 font-mono">{r.codigo}</td>
                    <td className="px-4 py-2">{r.finca}</td>
                    <td className="px-4 py-2">{r.ubicacion}</td>
                    <td className="px-4 py-2">{r.horaApertura ?? "—"}</td>
                    <td className="px-4 py-2">{r.horaCierre ?? "—"}</td>
                    <td className="px-4 py-2">{r.operadorName}</td>
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
