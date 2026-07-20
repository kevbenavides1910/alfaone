"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "@/lib/auth/client-session";
import { Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions/check";
import { formatDate } from "@/lib/utils/format";
import {
  feApiUrl,
  useFeCompany,
  withFeCompanyBody,
} from "@/components/facturacion-electronica/fe-company-context";

type FeConfigResponse = {
  configured: boolean;
  sucursales: Array<{
    puntosVenta: Array<{ id: string; codigo: string; nombre: string }>;
  }>;
};

type MensajeRow = {
  id: string;
  claveComprobante: string;
  cedulaEmisor: string;
  tipoMensaje: string;
  estado: string;
  createdAt: string;
  comprobante?: { consecutivo?: string; estadoHaciendaActual?: string } | null;
};

const TIPO_LABEL: Record<string, string> = {
  "1": "Aceptado",
  "2": "Aceptado parcial",
  "3": "Rechazado",
};

const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
  ERROR: "Error",
};

export default function MensajesReceptorPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const { companyCode, needsSelection } = useFeCompany();
  const canEdit = hasPermission(session, "facturacionElectronica.mensajes_receptor", "edit");

  const [puntoVentaId, setPuntoVentaId] = useState("");
  const [claveComprobante, setClaveComprobante] = useState("");
  const [cedulaEmisor, setCedulaEmisor] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"1" | "2" | "3">("1");
  const [detalleMensaje, setDetalleMensaje] = useState("");
  const [montoTotal, setMontoTotal] = useState("");
  const [montoImpuesto, setMontoImpuesto] = useState("");
  const [enviarAlGuardar, setEnviarAlGuardar] = useState(true);

  const configQ = useQuery({
    queryKey: ["fe-config", companyCode],
    queryFn: async (): Promise<FeConfigResponse> => {
      const r = await fetch(feApiUrl("/api/fe/config", companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar configuración");
      return j.data;
    },
    enabled: hasPermission(session, "facturacionElectronica.mensajes_receptor", "view") && Boolean(companyCode),
  });

  const listQ = useQuery({
    queryKey: ["fe-mensajes-receptor", companyCode],
    queryFn: async (): Promise<MensajeRow[]> => {
      const r = await fetch(feApiUrl("/api/fe/mensajes-receptor", companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al listar");
      return j.data as MensajeRow[];
    },
    enabled: Boolean(configQ.data?.configured) && Boolean(companyCode),
  });

  const puntosVenta = configQ.data?.sucursales.flatMap((s) => s.puntosVenta) ?? [];

  const saveM = useMutation({
    mutationFn: async () => {
      const body = {
        puntoVentaId,
        claveComprobante: claveComprobante.replace(/\D/g, ""),
        cedulaEmisor: cedulaEmisor.replace(/\D/g, ""),
        tipoMensaje,
        detalleMensaje: detalleMensaje.trim() || undefined,
        montoTotal: montoTotal ? Number(montoTotal) : undefined,
        montoTotalImpuesto: montoImpuesto ? Number(montoImpuesto) : undefined,
      };
      const r = await fetch("/api/fe/mensajes-receptor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withFeCompanyBody(body, companyCode)),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al crear mensaje");
      const id = j.data.id as string;
      if (enviarAlGuardar) {
        const r2 = await fetch(feApiUrl(`/api/fe/mensajes-receptor/${id}`, companyCode), { method: "POST" });
        const j2 = await r2.json();
        if (!r2.ok) throw new Error(j2.error?.message ?? "Mensaje creado pero falló el envío");
      }
      return id;
    },
    onSuccess: () => {
      toast.success(enviarAlGuardar ? "Mensaje enviado a Hacienda" : "Mensaje guardado");
      void qc.invalidateQueries({ queryKey: ["fe-mensajes-receptor", companyCode] });
      setClaveComprobante("");
      setDetalleMensaje("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (needsSelection) {
    return (
      <p className="text-sm text-amber-700">
        Seleccione la empresa emisora en el menú superior para continuar.
      </p>
    );
  }

  if (!configQ.data?.configured) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Configure el emisor en{" "}
          <Link href="/facturacion-electronica/configuracion" className="text-primary underline">
            configuración
          </Link>
          .
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Mensaje receptor</h2>
        <p className="text-sm text-muted-foreground">
          Acuse de recibo de comprobantes recibidos de proveedores (aceptar / rechazar ante Hacienda).
        </p>
      </div>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo mensaje</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Punto de venta</Label>
              <Select value={puntoVentaId} onValueChange={setPuntoVentaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione…" />
                </SelectTrigger>
                <SelectContent>
                  {puntosVenta.map((pv) => (
                    <SelectItem key={pv.id} value={pv.id}>
                      {pv.codigo} — {pv.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Clave del comprobante recibido (50 dígitos)</Label>
              <Input
                value={claveComprobante}
                onChange={(e) => setClaveComprobante(e.target.value)}
                maxLength={50}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Cédula emisor (proveedor)</Label>
              <Input value={cedulaEmisor} onChange={(e) => setCedulaEmisor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Respuesta</Label>
              <Select value={tipoMensaje} onValueChange={(v) => setTipoMensaje(v as typeof tipoMensaje)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — Aceptado</SelectItem>
                  <SelectItem value="2">2 — Aceptado parcialmente</SelectItem>
                  <SelectItem value="3">3 — Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>
                Detalle {tipoMensaje === "2" || tipoMensaje === "3" ? <span className="text-rose-600">*</span> : "(opcional)"}
              </Label>
              <Textarea value={detalleMensaje} onChange={(e) => setDetalleMensaje(e.target.value)} rows={2} />
              {(tipoMensaje === "2" || tipoMensaje === "3") && !detalleMensaje.trim() && (
                <p className="text-xs text-rose-600">Requerido para Aceptación Parcial o Rechazo</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Monto total (opcional)</Label>
              <Input type="number" min={0} value={montoTotal} onChange={(e) => setMontoTotal(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Impuesto total (opcional)</Label>
              <Input type="number" min={0} value={montoImpuesto} onChange={(e) => setMontoImpuesto(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="enviar-mr"
                type="checkbox"
                checked={enviarAlGuardar}
                onChange={(e) => setEnviarAlGuardar(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="enviar-mr">Enviar a Hacienda al guardar</Label>
            </div>
            <Button
              className="sm:col-span-2"
              disabled={
                saveM.isPending ||
                !puntoVentaId ||
                claveComprobante.length !== 50 ||
                ((tipoMensaje === "2" || tipoMensaje === "3") && !detalleMensaje.trim())
              }
              onClick={() => saveM.mutate()}
            >
              <Send className="mr-2 h-4 w-4" />
              {saveM.isPending ? "Procesando…" : enviarAlGuardar ? "Crear y enviar" : "Guardar borrador"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {listQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : !listQ.data?.length ? (
            <p className="text-sm text-muted-foreground">No hay mensajes receptor registrados.</p>
          ) : (
            listQ.data.map((m) => (
              <div key={m.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{ESTADO_LABEL[m.estado] ?? m.estado}</Badge>
                  <span>{TIPO_LABEL[m.tipoMensaje] ?? m.tipoMensaje}</span>
                  <span className="text-muted-foreground">{formatDate(m.createdAt)}</span>
                </div>
                <p className="mt-1 font-mono text-xs break-all">{m.claveComprobante}</p>
                <p className="text-muted-foreground">Emisor: {m.cedulaEmisor}</p>
                {m.comprobante?.consecutivo && (
                  <p className="text-muted-foreground">Consecutivo MR: {m.comprobante.consecutivo}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
