"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyTextButton } from "@/components/monitoreo/CopyTextButton";
import type { BandecoConsultaResult } from "@/modules/monitoreo/services/consulta";

export default function BandecoConsultaPage() {
  const [code, setCode] = useState("");
  const [searchCode, setSearchCode] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery<{ data: BandecoConsultaResult }>({
    queryKey: ["monitoreo-consulta", searchCode],
    queryFn: () =>
      fetch(`/api/monitoreo/consulta/${searchCode}`, { credentials: "same-origin" }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error?.message ?? "No encontrado");
        return json;
      }),
    enabled: searchCode != null,
    retry: false,
  });

  const info = data?.data;

  function handleSearch() {
    const n = Number(code.trim());
    if (!Number.isFinite(n) || n <= 0) return;
    setSearchCode(n);
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Consulta por código de alarma</h1>
          <p className="text-sm text-slate-500">
            Ingrese el código para ver información y mensajes de WhatsApp predefinidos.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="Ej. 5214"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              type="number"
            />
            <Button onClick={handleSearch} className="gap-2 shrink-0">
              <Search className="h-4 w-4" />
              Consultar
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <p className="text-slate-400 text-center py-8">Consultando...</p>}
      {isError && (
        <p className="text-red-600 text-center py-8">Código de alarma no encontrado en la base de datos.</p>
      )}

      {info && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información — Código {info.alarmNumber}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Finca" value={info.finca} />
              <Row label="Zona" value={info.zona} />
              <Row label="Motorizado" value={info.motorizado} />
              <Row label="Bodycam" value={info.bodycam} />
              <Row label="Grupo WhatsApp" value={info.grupoWsp} />
              <Row label="Encargado" value={info.encargado} />
              <Row label="Número encargado" value={info.numeroEncargado} />
              {info.pantalla != null && <Row label="Pantalla" value={String(info.pantalla)} />}
              {info.camara != null && (
                <Row
                  label="Cámara"
                  value={info.camaraDescripcion ? `${info.camara} — ${info.camaraDescripcion}` : String(info.camara)}
                />
              )}
              {info.zonaExterna && <Row label="Zona externa" value={info.zonaExterna} />}
              {info.pantalla2 != null && <Row label="2ª Pantalla" value={String(info.pantalla2)} />}
              {info.camara2 != null && (
                <Row
                  label="2ª Cámara"
                  value={
                    info.camara2Descripcion ? `${info.camara2} — ${info.camara2Descripcion}` : String(info.camara2)
                  }
                />
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <MessageCard title="Activación normal" text={info.mensajes.activacion} />
            <MessageCard title="Solicitud de pilas" text={info.mensajes.pilas} />
            <MessageCard title="Activación de riesgo" text={info.mensajes.riesgo} />
            <MessageCard title="Alerta máxima" text={info.mensajes.maxima} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-1.5">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}

function MessageCard({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CopyTextButton text={text} />
      </CardHeader>
      <CardContent>
        <pre className="text-xs whitespace-pre-wrap text-slate-700 bg-slate-50 rounded-md p-3 max-h-40 overflow-y-auto">
          {text}
        </pre>
      </CardContent>
    </Card>
  );
}
