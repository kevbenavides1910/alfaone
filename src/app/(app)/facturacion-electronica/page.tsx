"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AlertCircle, Plus, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hasPermission } from "@/lib/permissions/check";
import { formatDate } from "@/lib/utils/format";
import { feApiUrl, useFeCompany } from "@/components/facturacion-electronica/fe-company-context";

type FeNotaResumen = { total: string | number; estado: string };

type FeFacturaRow = {
  id: string;
  fecha: string;
  estado: string;
  tipoDocumento?: string;
  subtotal: string | number;
  totalImpuestos: string | number;
  total: string | number;
  cliente?: { nombre: string };
  comprobante?: { claveNumerica?: string; consecutivo?: string } | null;
  notasCredito?: FeNotaResumen[];
  notasDebito?: FeNotaResumen[];
  detalles?: Array<{ tarifaImpuesto: string | number }>;
};

function formatMonto(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  return Number(value).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTarifasIva(detalles?: Array<{ tarifaImpuesto: string | number }>) {
  if (!detalles?.length) return "—";
  const rates = [
    ...new Set(
      detalles.map((d) => Number(d.tarifaImpuesto)).filter((r) => Number.isFinite(r) && r > 0)
    ),
  ].sort((a, b) => b - a);
  if (!rates.length) return "0%";
  if (rates.length === 1) return `${rates[0]}%`;
  return rates.map((r) => `${r}%`).join(", ");
}

const NOTA_ESTADOS_ACEPTADOS = new Set(["ACEPTADA", "ACEPTADA_PARCIALMENTE"]);

function sumNotasReferencia(notas?: FeNotaResumen[]) {
  if (!notas?.length) return { total: 0, count: 0 };
  const aceptadas = notas.filter((n) => NOTA_ESTADOS_ACEPTADOS.has(n.estado));
  return {
    total: aceptadas.reduce((s, n) => s + Number(n.total), 0),
    count: aceptadas.length,
  };
}

function formatNotaColumna(resumen: { total: number; count: number }) {
  if (resumen.count === 0) return "—";
  const monto = resumen.total.toLocaleString("es-CR");
  return resumen.count > 1 ? `${monto} (${resumen.count})` : monto;
}

const TIPO_LABEL: Record<string, string> = {
  FACTURA_ELECTRONICA: "FE",
  TIQUETE_ELECTRONICO: "TE",
  FACTURA_ELECTRONICA_EXPORTACION: "FEE",
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

export default function FacturacionElectronicaPage() {
  const { data: session } = useSession();
  const { companyCode } = useFeCompany();
  const canEdit = hasPermission(session, "facturacionElectronica.facturas", "edit");

  const configQ = useQuery({
    queryKey: ["fe-config", companyCode],
    queryFn: async () => {
      const r = await fetch(feApiUrl("/api/fe/config", companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar configuración");
      return j.data as { configured: boolean };
    },
    enabled: hasPermission(session, "facturacionElectronica.facturas", "view") && Boolean(companyCode),
  });

  const facturasQ = useQuery({
    queryKey: ["fe-facturas", companyCode],
    queryFn: async () => {
      const r = await fetch(feApiUrl("/api/fe/facturas", companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al listar facturas");
      return j.data as { items: FeFacturaRow[]; total: number };
    },
    enabled: Boolean(configQ.data?.configured) && hasPermission(session, "facturacionElectronica.facturas", "view") && Boolean(companyCode),
  });

  if (configQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  if (!configQ.data?.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Emisor no configurado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Antes de emitir comprobantes debe configurar la razón social, certificado digital, sucursal y
            punto de venta.
          </p>
          {canEdit && (
            <Button asChild>
              <Link href="/facturacion-electronica/configuracion">
                <Settings className="mr-2 h-4 w-4" />
                Ir a configuración
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Comprobantes electrónicos</h2>
          <p className="text-sm text-muted-foreground">
            {facturasQ.data?.total ?? 0} factura(s) registrada(s)
          </p>
        </div>
        {canEdit && (
          <Button asChild>
            <Link href="/facturacion-electronica/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo comprobante
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {facturasQ.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando facturas…</p>
          ) : !facturasQ.data?.items.length ? (
            <p className="p-4 text-sm text-muted-foreground">No hay facturas electrónicas aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-4 py-2 font-medium">Tipo</th>
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 font-medium">Clave / consecutivo</th>
                    <th className="px-4 py-2 font-medium text-right">Subtotal (sin IVA)</th>
                    <th className="px-4 py-2 font-medium text-right">% IVA</th>
                    <th className="px-4 py-2 font-medium text-right">Monto IVA</th>
                    <th className="px-4 py-2 font-medium text-right">Total</th>
                    <th className="px-4 py-2 font-medium text-right">NC</th>
                    <th className="px-4 py-2 font-medium text-right">ND</th>
                  </tr>
                </thead>
                <tbody>
                  {facturasQ.data.items.map((row) => {
                    const nc = sumNotasReferencia(row.notasCredito);
                    const nd = sumNotasReferencia(row.notasDebito);
                    return (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2">
                        <Badge variant="secondary">{TIPO_LABEL[row.tipoDocumento ?? ""] ?? "FE"}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/facturacion-electronica/${row.id}`}
                          className="text-primary hover:underline"
                        >
                          {formatDate(row.fecha)}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{row.cliente?.nombre ?? "—"}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">{ESTADO_LABEL[row.estado] ?? row.estado}</Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {row.comprobante?.consecutivo ?? row.comprobante?.claveNumerica ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatMonto(row.subtotal)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatTarifasIva(row.detalles)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatMonto(row.totalImpuestos)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{formatMonto(row.total)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-amber-800 dark:text-amber-200">
                        {formatNotaColumna(nc)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-blue-800 dark:text-blue-200">
                        {formatNotaColumna(nd)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
