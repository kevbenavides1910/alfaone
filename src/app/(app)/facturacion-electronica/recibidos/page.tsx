"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, Trash2, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions/check";
import { formatDate } from "@/lib/utils/format";
import {
  feApiUrl,
  useFeCompany,
  withFeCompanyBody,
} from "@/components/facturacion-electronica/fe-company-context";

type RecibidoRow = {
  id: string;
  estado: string;
  clave: string | null;
  cedulaEmisor: string | null;
  nombreEmisor: string | null;
  montoTotal: string | null;
  emailSubject: string | null;
  emailFrom: string | null;
  emailReceivedAt: string | null;
  pdfPath: string | null;
  xmlPath: string | null;
  detalleError: string | null;
  mensajeReceptor?: {
    estado: string;
    comprobante?: { estadoHaciendaActual?: string | null } | null;
  } | null;
};

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  SIN_XML: "Sin XML — revisar",
  AUTO_ACEPTADO: "Auto-aceptado",
  ACEPTADO: "Aceptado",
  ACEPTADO_PARCIAL: "Aceptado parcial",
  RECHAZADO: "Rechazado",
  ERROR: "Error",
};

export default function ComprobantesRecibidosPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const { companyCode, needsSelection } = useFeCompany();
  const canEdit = hasPermission(session, "facturacionElectronica.recibidos", "edit");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [manualClave, setManualClave] = useState("");
  const [manualCedula, setManualCedula] = useState("");
  const [detalle, setDetalle] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"1" | "2" | "3">("1");

  const listQ = useQuery({
    queryKey: ["fe-comprobantes-recibidos", companyCode],
    queryFn: async (): Promise<RecibidoRow[]> => {
      const r = await fetch(feApiUrl("/api/fe/comprobantes-recibidos", companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al listar");
      return j.data as RecibidoRow[];
    },
    enabled: Boolean(companyCode) && hasPermission(session, "facturacionElectronica.recibidos", "view"),
  });

  const syncM = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/fe/comprobantes-recibidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withFeCompanyBody({}, companyCode)),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Sincronización fallida");
      return j.data as { processed: number; skipped: number };
    },
    onSuccess: (d) => {
      toast.success(`${d.processed} nuevos, ${d.skipped} omitidos`);
      void qc.invalidateQueries({ queryKey: ["fe-comprobantes-recibidos", companyCode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const purgeM = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/fe/comprobantes-recibidos/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withFeCompanyBody({}, companyCode)),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "No se pudo limpiar la bandeja");
      return j.data as { removed: number };
    },
    onSuccess: (d) => {
      toast.success(d.removed > 0 ? `${d.removed} comprobante(s) no válido(s) eliminado(s)` : "No había comprobantes no válidos");
      void qc.invalidateQueries({ queryKey: ["fe-comprobantes-recibidos", companyCode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const responderM = useMutation({
    mutationFn: async ({
      id,
      tipoMensaje,
      extra,
    }: {
      id: string;
      tipoMensaje: "1" | "2" | "3";
      extra?: Record<string, unknown>;
    }) => {
      const r = await fetch(feApiUrl(`/api/fe/comprobantes-recibidos/${id}`, companyCode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withFeCompanyBody(
            {
              tipoMensaje,
              detalleMensaje: detalle.trim() || undefined,
              ...extra,
            },
            companyCode
          )
        ),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al enviar mensaje receptor");
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.tipoMensaje === "3"
          ? "Rechazo enviado a Hacienda"
          : "Aceptación enviada — registrado en Gastos"
      );
      setExpandedId(null);
      void qc.invalidateQueries({ queryKey: ["fe-comprobantes-recibidos", companyCode] });
      void qc.invalidateQueries({ queryKey: ["fe-gastos", companyCode] });
      if (variables.tipoMensaje === "1" || variables.tipoMensaje === "2") {
        router.push("/facturacion-electronica/gastos");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (needsSelection) {
    return <p className="text-sm text-amber-700">Seleccione la empresa emisora en el menú superior.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Comprobantes recibidos</h2>
          <p className="text-sm text-muted-foreground">
            Facturas de proveedores leídas del buzón IMAP. Acepte o rechace ante Hacienda.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => syncM.mutate()} disabled={syncM.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar buzón
            </Button>
            <Button
              variant="outline"
              onClick={() => purgeM.mutate()}
              disabled={purgeM.isPending}
              title="Quita PDFs, nóminas y otros registros que no son facturas electrónicas de proveedor"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpiar no válidos
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bandeja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(listQ.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sin comprobantes. Configure IMAP en{" "}
              <Link href="/facturacion-electronica/configuracion" className="text-primary underline">
                configuración
              </Link>{" "}
              y sincronice.
            </p>
          )}
          {(listQ.data ?? []).map((row) => (
            <div key={row.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{row.nombreEmisor ?? row.emailFrom ?? "Proveedor"}</div>
                  <div className="font-mono text-xs text-muted-foreground">{row.clave ?? "Sin clave"}</div>
                  {row.emailSubject && (
                    <div className="mt-1 text-xs text-muted-foreground">{row.emailSubject}</div>
                  )}
                  {row.emailReceivedAt && (
                    <div className="text-xs text-muted-foreground">{formatDate(row.emailReceivedAt)}</div>
                  )}
                  {row.montoTotal && (
                    <div className="mt-1">Total: {Number(row.montoTotal).toLocaleString("es-CR")}</div>
                  )}
                  {row.detalleError && (
                    <div className="mt-1 text-xs text-red-600">{row.detalleError}</div>
                  )}
                </div>
                <Badge variant="outline">{ESTADO_LABEL[row.estado] ?? row.estado}</Badge>
              </div>

              {["PENDIENTE", "SIN_XML", "ERROR"].includes(row.estado) && canEdit && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  {expandedId === row.id ? (
                    <>
                      {(row.estado === "SIN_XML" || !row.clave) && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label>Clave (50 dígitos)</Label>
                            <Input
                              value={manualClave}
                              onChange={(e) => setManualClave(e.target.value)}
                              className="font-mono text-xs"
                              maxLength={50}
                              placeholder={row.clave ?? ""}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Cédula emisor</Label>
                            <Input
                              value={manualCedula}
                              onChange={(e) => setManualCedula(e.target.value)}
                              placeholder={row.cedulaEmisor ?? ""}
                            />
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label>Respuesta</Label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm"
                          value={tipoMensaje}
                          onChange={(e) => setTipoMensaje(e.target.value as "1" | "2" | "3")}
                        >
                          <option value="1">1 — Aceptado</option>
                          <option value="2">2 — Aceptado parcialmente</option>
                          <option value="3">3 — Rechazado</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label>
                          Detalle {tipoMensaje === "2" || tipoMensaje === "3" ? <span className="text-rose-600">*</span> : "(opcional)"}
                        </Label>
                        <Textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={2} />
                        {(tipoMensaje === "2" || tipoMensaje === "3") && !detalle.trim() && (
                          <p className="text-xs text-rose-600">Requerido para Aceptación Parcial o Rechazo</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            responderM.mutate({
                              id: row.id,
                              tipoMensaje: "1",
                              extra: {
                                clave: manualClave || row.clave || undefined,
                                cedulaEmisor: manualCedula || row.cedulaEmisor || undefined,
                              },
                            })
                          }
                          disabled={responderM.isPending}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Aceptar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            responderM.mutate({
                              id: row.id,
                              tipoMensaje: "2",
                              extra: {
                                clave: manualClave || row.clave || undefined,
                                cedulaEmisor: manualCedula || row.cedulaEmisor || undefined,
                                detalleMensaje: detalle.trim() || undefined,
                              },
                            })
                          }
                          disabled={responderM.isPending || (tipoMensaje === "2" && !detalle.trim())}
                        >
                          Aceptar parcial
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            responderM.mutate({
                              id: row.id,
                              tipoMensaje: "3",
                              extra: {
                                clave: manualClave || row.clave || undefined,
                                cedulaEmisor: manualCedula || row.cedulaEmisor || undefined,
                                detalleMensaje: detalle.trim() || undefined,
                              },
                            })
                          }
                          disabled={responderM.isPending || (tipoMensaje === "3" && !detalle.trim())}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Rechazar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setExpandedId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setExpandedId(row.id);
                        setManualClave(row.clave ?? "");
                        setManualCedula(row.cedulaEmisor ?? "");
                        setDetalle("");
                      }}
                    >
                      Responder a Hacienda
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
