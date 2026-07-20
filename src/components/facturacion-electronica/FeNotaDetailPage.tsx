"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "@/lib/auth/client-session";
import { ArrowLeft, Download, FileCode, Mail, RefreshCw, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions/check";
import { feApiUrl, useFeCompany } from "@/components/facturacion-electronica/fe-company-context";
import { parseJsonResponse } from "@/lib/api/parse-json-response";

type FeNotaDetail = {
  id: string;
  estado: string;
  razon: string;
  claveReferencia: string;
  subtotal: string | number;
  totalImpuestos: string | number;
  total: string | number;
  comprobante?: {
    claveNumerica?: string;
    consecutivo?: string;
    estadoHaciendaActual?: string;
    mensajeHacienda?: string | null;
    xmlRespuestaPath?: string | null;
  } | null;
  detalles?: Array<{
    numeroLinea: number;
    descripcion: string;
    cantidad: string | number;
    totalLinea: string | number;
  }>;
  facturaReferencia?: { id: string } | null;
  facturaCompraReferencia?: { id: string } | null;
  reciboPagoReferencia?: { id: string } | null;
};

const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  PENDIENTE_ENVIO: "Pendiente envío",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  ACEPTADA_PARCIALMENTE: "Aceptada parcial",
  RECHAZADA: "Rechazada",
  ERROR: "Error",
  ANULADA: "Anulada",
};

export function FeNotaDetailPage({ tipo }: { tipo: "credito" | "debito" }) {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const { companyCode, needsSelection } = useFeCompany();
  const canEdit = hasPermission(session, "facturacionElectronica.facturas", "edit");
  const apiBase = tipo === "credito" ? "/api/fe/notas-credito" : "/api/fe/notas-debito";
  const titulo = tipo === "credito" ? "Nota de crédito" : "Nota de débito";

  const notaQ = useQuery({
    queryKey: ["fe-nota", tipo, id, companyCode],
    queryFn: async (): Promise<FeNotaDetail> => {
      const r = await fetch(feApiUrl(`${apiBase}/${id}`, companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar nota");
      return j.data;
    },
    enabled:
      Boolean(id) &&
      Boolean(companyCode) &&
      hasPermission(session, "facturacionElectronica.facturas", "view"),
  });

  const enviarM = useMutation({
    mutationFn: async () => {
      const r = await fetch(feApiUrl(`${apiBase}/${id}`, companyCode), { method: "POST" });
      const j = await parseJsonResponse<{ data?: { estado?: string }; error?: { message?: string } }>(r);
      if (!r.ok) throw new Error(j.error?.message ?? "Error al enviar");
      return j.data;
    },
    onSuccess: (data) => {
      if (data?.estado === "RECHAZADA") toast.error("Hacienda rechazó la nota.");
      else toast.success("Nota enviada a Hacienda");
      void qc.invalidateQueries({ queryKey: ["fe-nota", tipo, id, companyCode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const estadoM = useMutation({
    mutationFn: async () => {
      const r = await fetch(feApiUrl(`${apiBase}/${id}/estado`, companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al consultar estado");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      void qc.invalidateQueries({ queryKey: ["fe-nota", tipo, id, companyCode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const correoM = useMutation({
    mutationFn: async () => {
      const r = await fetch(feApiUrl(`${apiBase}/${id}/reenviar-correo`, companyCode), { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al enviar correo");
      return j.data;
    },
    onSuccess: (data) => {
      if (data?.skipped) toast.info(data.reason ?? "Correo omitido");
      else toast.success("Correo enviado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nota = notaQ.data;
  const puedeEnviar = nota && ["BORRADOR", "ERROR", "PENDIENTE_ENVIO"].includes(nota.estado);
  const puedeCorreo =
    nota?.comprobante &&
    ["ACEPTADA", "ACEPTADA_PARCIALMENTE", "ENVIADA"].includes(nota.estado);
  const tieneArchivos = Boolean(nota?.comprobante?.claveNumerica);

  const backHref =
    nota?.facturaReferencia?.id
      ? `/facturacion-electronica/${nota.facturaReferencia.id}`
      : nota?.facturaCompraReferencia?.id
        ? `/facturacion-electronica/compra/${nota.facturaCompraReferencia.id}`
        : nota?.reciboPagoReferencia?.id
          ? `/facturacion-electronica/recibo-pago/${nota.reciboPagoReferencia.id}`
          : "/facturacion-electronica";

  if (needsSelection) {
    return (
      <p className="text-sm text-amber-700">
        Seleccione la empresa emisora en el menú superior para continuar.
      </p>
    );
  }

  if (notaQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando nota…</p>;
  }

  if (notaQ.isError || !nota) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">No se pudo cargar la nota.</p>
          <Button variant="link" asChild className="px-0">
            <Link href="/facturacion-electronica">Volver</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <p className="text-sm text-muted-foreground line-clamp-2">{nota.razon}</p>
        </div>
        <Badge variant="outline">{ESTADO_LABEL[nota.estado] ?? nota.estado}</Badge>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {puedeEnviar && (
            <Button onClick={() => enviarM.mutate()} disabled={enviarM.isPending}>
              <Send className="mr-2 h-4 w-4" />
              {enviarM.isPending ? "Enviando…" : "Enviar a Hacienda"}
            </Button>
          )}
          {nota.comprobante && (
            <Button variant="outline" onClick={() => estadoM.mutate()} disabled={estadoM.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Consultar estado
            </Button>
          )}
          {puedeCorreo && (
            <Button variant="outline" onClick={() => correoM.mutate()} disabled={correoM.isPending}>
              <Mail className="mr-2 h-4 w-4" />
              {correoM.isPending ? "Enviando…" : "Enviar / reenviar correo"}
            </Button>
          )}
          {tieneArchivos && (
            <>
              <Button variant="outline" asChild>
                <a href={feApiUrl(`${apiBase}/${id}/pdf`, companyCode)} download>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={feApiUrl(`${apiBase}/${id}/xml`, companyCode)} download>
                  <FileCode className="mr-2 h-4 w-4" />
                  XML
                </a>
              </Button>
            </>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comprobante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {nota.comprobante?.consecutivo && (
            <p>
              <span className="text-muted-foreground">Consecutivo:</span> {nota.comprobante.consecutivo}
            </p>
          )}
          {nota.comprobante?.claveNumerica && (
            <p className="break-all">
              <span className="text-muted-foreground">Clave:</span> {nota.comprobante.claveNumerica}
            </p>
          )}
          {nota.comprobante?.estadoHaciendaActual && (
            <p>
              <span className="text-muted-foreground">Hacienda:</span> {nota.comprobante.estadoHaciendaActual}
              {nota.comprobante.mensajeHacienda ? ` — ${nota.comprobante.mensajeHacienda}` : ""}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Total:</span>{" "}
            {Number(nota.total).toLocaleString("es-CR")}
          </p>
        </CardContent>
      </Card>

      {nota.detalles && nota.detalles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalle</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Descripción</th>
                  <th className="px-4 py-2 text-right">Cant.</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {nota.detalles.map((d) => (
                  <tr key={d.numeroLinea} className="border-b last:border-0">
                    <td className="px-4 py-2">{d.numeroLinea}</td>
                    <td className="px-4 py-2">{d.descripcion}</td>
                    <td className="px-4 py-2 text-right">{Number(d.cantidad)}</td>
                    <td className="px-4 py-2 text-right">{Number(d.totalLinea).toLocaleString("es-CR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
