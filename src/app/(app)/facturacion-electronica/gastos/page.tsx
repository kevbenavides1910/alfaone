"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { hasPermission } from "@/lib/permissions/check";
import { formatDate } from "@/lib/utils/format";
import { feApiUrl, useFeCompany } from "@/components/facturacion-electronica/fe-company-context";

type GastoResumen = {
  cantidad: number;
  totales: {
    subtotal: number;
    descuentos: number;
    impuestos: number;
    total: number;
  };
  ivaPorTarifa: Array<{
    tarifaPercent: number;
    codigoTarifaIVA: string;
    montoImpuesto: number;
  }>;
  items: Array<{
    id: string;
    clave: string;
    fechaEmision: string;
    cedulaEmisor: string;
    nombreEmisor: string | null;
    total: number;
    totalImpuestos: number;
    moneda: string;
    estadoRecibo: string;
    impuestos: Array<{ tarifaPercent: number; montoImpuesto: number }>;
  }>;
};

function monthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    desde: `${y}-${m}-01`,
    hasta: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

function fmtMoney(value: number, moneda = "CRC") {
  return `${value.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;
}

export default function FeGastosPage() {
  const { data: session } = useSession();
  const { companyCode, needsSelection } = useFeCompany();
  const initial = useMemo(() => monthRange(), []);
  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);

  const resumenQ = useQuery({
    queryKey: ["fe-gastos", companyCode, desde, hasta],
    queryFn: async (): Promise<GastoResumen> => {
      const params = new URLSearchParams({ desde, hasta });
      const r = await fetch(feApiUrl(`/api/fe/gastos?${params.toString()}`, companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar gastos");
      return j.data as GastoResumen;
    },
    enabled: Boolean(companyCode) && hasPermission(session, "facturacionElectronica.gastos", "view"),
  });

  if (needsSelection) {
    return <p className="text-sm text-amber-700">Seleccione la empresa emisora en el menú superior.</p>;
  }

  const data = resumenQ.data;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Gastos de proveedor</h2>
        <p className="text-sm text-muted-foreground">
          Facturas aceptadas ante Hacienda desde{" "}
          <Link href="/facturacion-electronica/recibidos" className="text-primary underline">
            Recibidos
          </Link>
          . Totales e IVA desglosado por tarifa.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rango de fechas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="gastos-desde">Desde</Label>
            <Input id="gastos-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gastos-hasta">Hasta</Label>
            <Input id="gastos-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {resumenQ.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {resumenQ.isError && (
        <p className="text-sm text-red-600">{(resumenQ.error as Error).message}</p>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Comprobantes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{data.cantidad}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Subtotal neto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{fmtMoney(data.totales.subtotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total IVA</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{fmtMoney(data.totales.impuestos)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total gastos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{fmtMoney(data.totales.total)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">IVA por tarifa</CardTitle>
            </CardHeader>
            <CardContent>
              {data.ivaPorTarifa.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin IVA en el período seleccionado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4">Tarifa</th>
                        <th className="py-2 pr-4">Código tarifa</th>
                        <th className="py-2 text-right">Monto IVA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ivaPorTarifa.map((row) => (
                        <tr key={`${row.codigoTarifaIVA}-${row.tarifaPercent}`} className="border-b">
                          <td className="py-2 pr-4 font-medium">{row.tarifaPercent}%</td>
                          <td className="py-2 pr-4 font-mono text-xs">{row.codigoTarifaIVA}</td>
                          <td className="py-2 text-right">{fmtMoney(row.montoImpuesto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle de comprobantes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay gastos en este período. Acepte facturas en Recibidos para registrarlas aquí.
                </p>
              ) : (
                data.items.map((row) => (
                  <div key={row.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{row.nombreEmisor ?? row.cedulaEmisor}</div>
                        <div className="font-mono text-xs text-muted-foreground">{row.clave}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(row.fechaEmision)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{fmtMoney(row.total, row.moneda)}</div>
                        <div className="text-xs text-muted-foreground">
                          IVA: {fmtMoney(row.totalImpuestos, row.moneda)}
                        </div>
                        <Badge variant="outline" className="mt-1">
                          {row.estadoRecibo}
                        </Badge>
                      </div>
                    </div>
                    {row.impuestos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 border-t pt-2 text-xs text-muted-foreground">
                        {row.impuestos.map((imp) => (
                          <span key={`${row.id}-${imp.tarifaPercent}`}>
                            {imp.tarifaPercent}%: {fmtMoney(imp.montoImpuesto, row.moneda)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
