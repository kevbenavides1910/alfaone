"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Download, FileCode, Plus, RefreshCw, Send, FileMinus, FilePlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions/check";
import { formatDate } from "@/lib/utils/format";
import { feApiUrl, useFeCompany } from "@/components/facturacion-electronica/fe-company-context";

type FeReciboRow = {
  id: string;
  createdAt: string;
  estado: string;
  claveReferencia: string;
  total: string | number;
  comprobante?: { consecutivo?: string; claveNumerica?: string } | null;
  facturaReferencia?: { cliente?: { nombre: string } } | null;
};

const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  PENDIENTE_ENVIO: "Pendiente envío",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
  ERROR: "Error",
};

export default function ReciboPagoListPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const { companyCode } = useFeCompany();
  const canEdit = hasPermission(session, "facturacionElectronica.recibos_pago", "edit");

  const listQ = useQuery({
    queryKey: ["fe-recibos-pago", companyCode],
    queryFn: async () => {
      const r = await fetch(feApiUrl("/api/fe/recibos-pago", companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al listar");
      return j.data as { items: FeReciboRow[]; total: number };
    },
    enabled: hasPermission(session, "facturacionElectronica.recibos_pago", "view") && Boolean(companyCode),
  });

  const enviarM = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(feApiUrl(`/api/fe/recibos-pago/${id}/enviar`, companyCode), { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al enviar");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Recibo encolado para envío");
      void qc.invalidateQueries({ queryKey: ["fe-recibos-pago"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const estadoM = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(feApiUrl(`/api/fe/recibos-pago/${id}/estado`, companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al consultar");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      void qc.invalidateQueries({ queryKey: ["fe-recibos-pago"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Recibos electrónicos de pago (REP)</h2>
          <p className="text-sm text-muted-foreground">{listQ.data?.total ?? 0} documento(s)</p>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href="/facturacion-electronica/recibo-pago/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo REP
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
          ) : !listQ.data?.items.length ? (
            <p className="p-4 text-sm text-muted-foreground">No hay recibos de pago registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium">Referencia</th>
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 font-medium text-right">Total</th>
                    {canEdit && <th className="px-4 py-2 font-medium">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {listQ.data.items.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{row.claveReferencia}</td>
                      <td className="px-4 py-2">{row.facturaReferencia?.cliente?.nombre ?? "—"}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">{ESTADO_LABEL[row.estado] ?? row.estado}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right">{Number(row.total).toLocaleString("es-CR")}</td>
                      {canEdit && (
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {["BORRADOR", "ERROR", "PENDIENTE_ENVIO"].includes(row.estado) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => enviarM.mutate(row.id)}
                                disabled={enviarM.isPending}
                              >
                                <Send className="mr-1 h-3 w-3" />
                                Enviar
                              </Button>
                            )}
                            {["ACEPTADA", "ACEPTADA_PARCIALMENTE"].includes(row.estado) && (
                              <>
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/facturacion-electronica/recibo-pago/${row.id}/nota-credito`}>
                                    <FileMinus className="mr-1 h-3 w-3" />
                                    NC
                                  </Link>
                                </Button>
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/facturacion-electronica/recibo-pago/${row.id}/nota-debito`}>
                                    <FilePlus className="mr-1 h-3 w-3" />
                                    ND
                                  </Link>
                                </Button>
                              </>
                            )}
                            {row.comprobante?.claveNumerica && (
                              <>
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={feApiUrl(`/api/fe/recibos-pago/${row.id}/pdf`, companyCode)} download>
                                    <Download className="h-3 w-3" />
                                  </a>
                                </Button>
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={feApiUrl(`/api/fe/recibos-pago/${row.id}/xml`, companyCode)} download>
                                    <FileCode className="h-3 w-3" />
                                  </a>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => estadoM.mutate(row.id)}
                                  disabled={estadoM.isPending}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
