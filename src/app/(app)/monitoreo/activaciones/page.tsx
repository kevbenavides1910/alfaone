"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/client-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { CopyTextButton } from "@/components/monitoreo/CopyTextButton";
import { InformeFotosPaste, type InformeFoto } from "@/components/monitoreo/InformeFotosPaste";

export default function MonitoreoActivacionesPage() {
  const { data: session } = useSession();
  const [alarmNumber, setAlarmNumber] = useState("");
  const [estado, setEstado] = useState(
    "A este x11 informa el oficial que todo se encuentra en orden",
  );
  const [informe, setInforme] = useState("");
  const [tipo, setTipo] = useState<"normal" | "riesgo" | "maxima">("normal");
  const [fotos, setFotos] = useState<InformeFoto[]>([]);

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/monitoreo/activaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alarmNumber: Number(alarmNumber),
          estado,
          informe: informe || undefined,
          tipoActivacion: tipo,
          imagenes: fotos.map(({ url, fileName, mimeType }) => ({ url, fileName, mimeType })),
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "Error al registrar");
      return json.data;
    },
    onSuccess: (row) => {
      toast.success("Activación registrada");
      if (row?.informe) setInforme(row.informe);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Registro de activación</h1>
        <p className="text-sm text-slate-500">
          Genera informe, adjunta fotos con Ctrl+V y registra en bitácora.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de activación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-slate-600">Código de activación</label>
            <Input
              type="number"
              value={alarmNumber}
              onChange={(e) => setAlarmNumber(e.target.value)}
              placeholder="Ej. 5229"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm text-slate-600">Tipo de activación</label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "normal" | "riesgo" | "maxima")}
            >
              <option value="normal">Normal</option>
              <option value="riesgo">Riesgo</option>
              <option value="maxima">Alerta máxima</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-600">Estado / reporte del oficial</label>
            <Textarea value={estado} onChange={(e) => setEstado(e.target.value)} rows={2} className="mt-1" />
          </div>

          <div>
            <label className="text-sm text-slate-600">Informe redactado (opcional, se genera automático)</label>
            <Textarea value={informe} onChange={(e) => setInforme(e.target.value)} rows={8} className="mt-1 font-mono text-xs" />
          </div>

          <InformeFotosPaste value={fotos} onChange={setFotos} />

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => mutation.mutate()}
              disabled={!alarmNumber || mutation.isPending}
            >
              {mutation.isPending ? "Registrando..." : "Registrar activación"}
            </Button>
            {informe && <CopyTextButton text={informe} label="Copiar informe" />}
          </div>

          <p className="text-xs text-slate-400">
            Operador: {session?.user?.name ?? session?.user?.email ?? "—"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
