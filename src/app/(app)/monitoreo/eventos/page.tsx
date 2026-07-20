"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/client-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { CopyTextButton } from "@/components/monitoreo/CopyTextButton";
import { InformeFotosPaste, type InformeFoto } from "@/components/monitoreo/InformeFotosPaste";

type EventoRow = {
  id: string;
  fecha: string;
  hora: string | null;
  finca: string;
  motivo: string | null;
  informe: string;
  operadorName: string;
  imagenes?: InformeFoto[] | null;
};

export default function MonitoreoEventosPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [finca, setFinca] = useState("");
  const [motivo, setMotivo] = useState("");
  const [informe, setInforme] = useState("");
  const [fotos, setFotos] = useState<InformeFoto[]>([]);

  const { data, isLoading } = useQuery<{ data: EventoRow[] }>({
    queryKey: ["monitoreo-eventos"],
    queryFn: () => fetch("/api/monitoreo/eventos").then((r) => r.json()),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/monitoreo/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finca,
          motivo: motivo || null,
          informe,
          operadorName: session?.user?.name ?? "Operador",
          imagenes: fotos.map(({ url, fileName, mimeType }) => ({ url, fileName, mimeType })),
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "Error");
      return json;
    },
    onSuccess: () => {
      toast.success("Evento registrado");
      setFinca("");
      setMotivo("");
      setInforme("");
      setFotos([]);
      void qc.invalidateQueries({ queryKey: ["monitoreo-eventos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];
  const now = new Date();
  const previewInforme = [
    `INFORME DE EVENTO - FECHA: ${now.toLocaleDateString("es-CR")}`,
    `FECHA: ${now.toLocaleDateString("es-CR")}`,
    `HORA: ${now.toLocaleTimeString("es-CR")}`,
    `FINCA: ${finca || "—"}`,
    `MOTIVO: ${motivo || "—"}`,
    `INFORME: ${informe || "—"}`,
    `Operador: ${session?.user?.name ?? "—"}`,
    fotos.length ? `Imágenes adjuntas: ${fotos.length}` : "Imagen de referencia:",
  ].join("\n");

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Informes de eventos</h1>
        <p className="text-sm text-slate-500">
          Bitácora de eventos. Pegá capturas con Ctrl+V en el área de fotos.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Nuevo evento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Finca" value={finca} onChange={(e) => setFinca(e.target.value)} />
          <Input
            placeholder="Motivo (ej. Pila media vacía)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <Textarea
            placeholder="Informe detallado"
            value={informe}
            onChange={(e) => setInforme(e.target.value)}
            rows={5}
          />
          <InformeFotosPaste value={fotos} onChange={setFotos} />
          <div className="flex gap-2">
            <Button
              onClick={() => mutation.mutate()}
              disabled={!finca || !informe || mutation.isPending}
            >
              Registrar evento
            </Button>
            <CopyTextButton text={previewInforme} label="Copiar informe" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-8 text-center text-slate-400">Cargando...</p>
          ) : (
            <div className="divide-y">
              {rows.map((r) => {
                const imgs = Array.isArray(r.imagenes) ? r.imagenes : [];
                return (
                  <div key={r.id} className="p-4 space-y-2">
                    <div className="flex flex-wrap gap-2 text-sm text-slate-500">
                      <span>{new Date(r.fecha).toLocaleDateString("es-CR")}</span>
                      {r.hora && <span>{r.hora}</span>}
                      <span className="font-medium text-slate-800">{r.finca}</span>
                      {r.motivo && <span>— {r.motivo}</span>}
                      <span className="ml-auto">{r.operadorName}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{r.informe}</p>
                    {imgs.length > 0 && (
                      <ul className="flex flex-wrap gap-2 pt-1">
                        {imgs.map((img) => (
                          <li key={img.fileName}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt=""
                              className="h-16 w-16 object-cover rounded border border-slate-200"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
