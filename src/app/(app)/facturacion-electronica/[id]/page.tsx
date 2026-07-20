"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "@/lib/auth/client-session";
import { ArrowLeft, Download, FileCode, Mail, Pencil, RefreshCw, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions/check";
import { formatDate } from "@/lib/utils/format";
import { feApiUrl, useFeCompany } from "@/components/facturacion-electronica/fe-company-context";
import { parseJsonResponse } from "@/lib/api/parse-json-response";

type FeFacturaDetail = {
  id: string;
  fecha: string;
  estado: string;
  condicionVenta?: string;
  tipoDocumento?: string;
  moneda: string;
  subtotal: string | number;
  totalImpuestos: string | number;
  total: string | number;
  observaciones?: string | null;
  cliente?: {
    id?: string;
    nombre: string;
    identificacion: string;
    email?: string | null;
    direccionProvincia?: string | null;
    direccionCanton?: string | null;
    direccionDistrito?: string | null;
  };
  comprobante?: {
    claveNumerica?: string;
    consecutivo?: string;
    estadoHaciendaActual?: string;
    mensajeHacienda?: string | null;
  } | null;
  detalles?: Array<{
    numeroLinea: number;
    descripcion: string;
    cantidad: string | number;
    precioUnitario: string | number;
    totalLinea: string | number;
  }>;
  notasCredito?: Array<{
    id: string;
    estado: string;
    razon: string;
    total: string | number;
    comprobante?: { consecutivo?: string; estadoHaciendaActual?: string } | null;
  }>;
  notasDebito?: Array<{
    id: string;
    estado: string;
    razon: string;
    total: string | number;
    comprobante?: { consecutivo?: string; estadoHaciendaActual?: string } | null;
  }>;
};

const TIPO_TITULO: Record<string, string> = {
  FACTURA_ELECTRONICA: "Factura electrónica",
  TIQUETE_ELECTRONICO: "Tiquete electrónico",
  FACTURA_ELECTRONICA_EXPORTACION: "Factura de exportación",
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

export default function FacturaElectronicaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const { companyCode, needsSelection } = useFeCompany();
  const canEdit = hasPermission(session, "facturacionElectronica.facturas", "edit");

  const facturaQ = useQuery({
    queryKey: ["fe-factura", id, companyCode],
    queryFn: async (): Promise<FeFacturaDetail> => {
      const r = await fetch(feApiUrl(`/api/fe/facturas/${id}`, companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar factura");
      return j.data;
    },
    enabled:
      Boolean(id) &&
      Boolean(companyCode) &&
      hasPermission(session, "facturacionElectronica.facturas", "view"),
  });

  const enviarM = useMutation({
    mutationFn: async () => {
      const r = await fetch(feApiUrl(`/api/fe/facturas/${id}/enviar`, companyCode), { method: "POST" });
      const j = await parseJsonResponse<{ data?: { estado?: string }; error?: { message?: string } }>(r);
      if (!r.ok) throw new Error(j.error?.message ?? "Error al enviar");
      return j.data;
    },
    onSuccess: (data: { estado?: string } | undefined) => {
      if (data?.estado === "RECHAZADA") {
        toast.error(
          "Hacienda rechazó el comprobante. Revise el detalle abajo y emita una nueva factura con otro consecutivo."
        );
      } else if (data?.estado === "ERROR") {
        toast.error("Error al procesar el envío. Revise el mensaje de Hacienda.");
      } else {
        toast.success("Factura enviada a Hacienda");
      }
      void qc.invalidateQueries({ queryKey: ["fe-factura", id, companyCode] });
      void qc.invalidateQueries({ queryKey: ["fe-facturas", companyCode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const estadoM = useMutation({
    mutationFn: async () => {
      const r = await fetch(feApiUrl(`/api/fe/facturas/${id}/estado`, companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al consultar estado");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      void qc.invalidateQueries({ queryKey: ["fe-factura", id, companyCode] });
      void qc.invalidateQueries({ queryKey: ["fe-facturas", companyCode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const correoM = useMutation({
    mutationFn: async () => {
      const r = await fetch(feApiUrl(`/api/fe/facturas/${id}/reenviar-correo`, companyCode), {
        method: "POST",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al enviar correo");
      return j.data;
    },
    onSuccess: (data) => {
      if (data?.skipped) toast.info(data.reason ?? "Correo omitido");
      else toast.success("Correo enviado al cliente");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const factura = facturaQ.data;
  const puedeEnviar =
    factura && ["BORRADOR", "ERROR", "PENDIENTE_ENVIO"].includes(factura.estado);
  const puedeNotas =
    factura && ["ACEPTADA", "ACEPTADA_PARCIALMENTE"].includes(factura.estado);
  const tieneArchivos = Boolean(factura?.comprobante?.claveNumerica);

  const puedeRecibo =
    factura &&
    factura.condicionVenta === "CREDITO" &&
    ["ACEPTADA", "ACEPTADA_PARCIALMENTE"].includes(factura.estado) &&
    Boolean(factura.comprobante?.claveNumerica);

  const puedeCorreo =
    factura?.comprobante &&
    ["ACEPTADA", "ACEPTADA_PARCIALMENTE", "ENVIADA"].includes(factura.estado);

  const faltaUbicacionCliente =
    factura?.cliente &&
    factura.tipoDocumento !== "TIQUETE_ELECTRONICO" &&
    (!factura.cliente.direccionProvincia?.trim() ||
      !factura.cliente.direccionCanton?.trim() ||
      !factura.cliente.direccionDistrito?.trim());

  if (needsSelection) {
    return (
      <p className="text-sm text-amber-700">
        Seleccione la empresa emisora en el menú superior para continuar.
      </p>
    );
  }

  if (facturaQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando factura…</p>;
  }

  if (facturaQ.isError || !factura) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">No se pudo cargar la factura.</p>
          <Button variant="link" asChild className="px-0">
            <Link href="/facturacion-electronica">Volver al listado</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/facturacion-electronica">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">
            {TIPO_TITULO[factura.tipoDocumento ?? ""] ?? "Factura electrónica"}
          </h2>
          <p className="text-sm text-muted-foreground">{factura.cliente?.nombre ?? "Consumidor final"}</p>
        </div>
        <Badge variant="outline">{ESTADO_LABEL[factura.estado] ?? factura.estado}</Badge>
      </div>

      {factura.estado === "RECHAZADA" && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Esta clave fue rechazada por Hacienda y no puede reutilizarse. Cree una{" "}
          <Link href="/facturacion-electronica/nueva" className="font-medium underline">
            nueva factura
          </Link>{" "}
          para obtener un consecutivo distinto.
        </p>
      )}

      {faltaUbicacionCliente && puedeEnviar && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Falta la ubicación del cliente (provincia, cantón o distrito).{" "}
          {canEdit ? (
            <>
              Use{" "}
              <Link href={`/facturacion-electronica/${id}/editar`} className="font-medium underline">
                Editar
              </Link>{" "}
              para completar los datos antes de enviar a Hacienda.
            </>
          ) : (
            "Solicite a un usuario con permiso de edición que complete los datos del cliente."
          )}
        </p>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {puedeEnviar && (
            <Button variant="outline" asChild>
              <Link href={`/facturacion-electronica/${id}/editar`}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
          )}
          {puedeEnviar && (
            <Button onClick={() => enviarM.mutate()} disabled={enviarM.isPending}>
              <Send className="mr-2 h-4 w-4" />
              {enviarM.isPending ? "Enviando…" : "Enviar a Hacienda"}
            </Button>
          )}
          {factura.comprobante && (
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
                <a href={feApiUrl(`/api/fe/facturas/${id}/pdf`, companyCode)} download>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={feApiUrl(`/api/fe/facturas/${id}/xml`, companyCode)} download>
                  <FileCode className="mr-2 h-4 w-4" />
                  XML
                </a>
              </Button>
            </>
          )}
          {puedeNotas && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/facturacion-electronica/${id}/nota-credito`}>Nota de crédito</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/facturacion-electronica/${id}/nota-debito`}>Nota de débito</Link>
              </Button>
            </>
          )}
          {puedeRecibo && (
            <Button variant="outline" asChild>
              <Link href={`/facturacion-electronica/recibo-pago/nueva?facturaId=${id}`}>
                Recibo de pago
              </Link>
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comprobante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Fecha:</span> {formatDate(factura.fecha)}
          </p>
          <p>
            <span className="text-muted-foreground">Cliente:</span> {factura.cliente?.nombre} (
            {factura.cliente?.identificacion})
          </p>
          {factura.cliente?.email && (
            <p>
              <span className="text-muted-foreground">Correo:</span> {factura.cliente.email}
            </p>
          )}
          {factura.comprobante?.consecutivo && (
            <p>
              <span className="text-muted-foreground">Consecutivo:</span>{" "}
              <span className="font-mono">{factura.comprobante.consecutivo}</span>
            </p>
          )}
          {factura.comprobante?.claveNumerica && (
            <p className="break-all">
              <span className="text-muted-foreground">Clave:</span>{" "}
              <span className="font-mono text-xs">{factura.comprobante.claveNumerica}</span>
            </p>
          )}
          {factura.comprobante?.estadoHaciendaActual && (
            <p>
              <span className="text-muted-foreground">Hacienda:</span>{" "}
              {factura.comprobante.estadoHaciendaActual}
              {factura.comprobante.mensajeHacienda ? ` — ${factura.comprobante.mensajeHacienda}` : ""}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Total:</span>{" "}
            {Number(factura.total).toLocaleString("es-CR")} {factura.moneda}
          </p>
        </CardContent>
      </Card>

      {factura.detalles && factura.detalles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalle</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                {factura.detalles.map((d) => (
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

      {((factura.notasCredito?.length ?? 0) > 0 || (factura.notasDebito?.length ?? 0) > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas asociadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {factura.notasCredito?.map((n) => (
              <p key={n.id}>
                <Link
                  href={`/facturacion-electronica/notas-credito/${n.id}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  NC — {ESTADO_LABEL[n.estado] ?? n.estado}
                  {n.comprobante?.consecutivo ? ` (${n.comprobante.consecutivo})` : ""}
                </Link>
                : {Number(n.total).toLocaleString("es-CR")} — {n.razon.slice(0, 80)}
              </p>
            ))}
            {factura.notasDebito?.map((n) => (
              <p key={n.id}>
                <Link
                  href={`/facturacion-electronica/notas-debito/${n.id}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  ND — {ESTADO_LABEL[n.estado] ?? n.estado}
                  {n.comprobante?.consecutivo ? ` (${n.comprobante.consecutivo})` : ""}
                </Link>
                : {Number(n.total).toLocaleString("es-CR")} — {n.razon.slice(0, 80)}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
