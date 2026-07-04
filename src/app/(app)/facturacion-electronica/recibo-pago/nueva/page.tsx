"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import {
  feApiUrl,
  useFeCompany,
  withFeCompanyBody,
} from "@/components/facturacion-electronica/fe-company-context";

type FeConfigResponse = {
  configured: boolean;
  sucursales: Array<{
    id: string;
    nombre: string;
    puntosVenta: Array<{ id: string; codigo: string; nombre: string }>;
  }>;
};

type FeFacturaRef = {
  id: string;
  condicionVenta: string;
  tipoDocumento?: string;
  total: string | number;
  comprobante?: { claveNumerica?: string } | null;
  cliente?: { nombre: string };
};

const TIPO_DOC_REF: Record<string, string> = {
  FACTURA_ELECTRONICA: "01",
  TIQUETE_ELECTRONICO: "04",
  FACTURA_ELECTRONICA_EXPORTACION: "09",
};

const REP_CONDICIONES = [
  { value: "PAGO_VENTA_CREDITO", label: "Pago venta a crédito" },
  { value: "PAGO_VENTA_PARCELADO", label: "Pago venta parcelado" },
  { value: "VENTA_CREDITO_IVA_90_DIAS", label: "Venta crédito IVA 90 días" },
  { value: "PAGO_SERVICIOS_ESTADO", label: "Pago servicios del Estado" },
] as const;

export default function NuevoReciboPagoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const facturaRefId = searchParams.get("facturaId") ?? "";
  const qc = useQueryClient();
  const { companyCode, needsSelection } = useFeCompany();

  const [puntoVentaId, setPuntoVentaId] = useState("");
  const [claveReferencia, setClaveReferencia] = useState("");
  const [tipoDocReferencia, setTipoDocReferencia] = useState("01");
  const [facturaReferenciaId, setFacturaReferenciaId] = useState(facturaRefId);
  const [condicionVenta, setCondicionVenta] = useState("PAGO_VENTA_CREDITO");
  const [medioPago, setMedioPago] = useState("TRANSFERENCIA_DEPOSITO");
  const [descripcion, setDescripcion] = useState("Abono a factura");
  const [monto, setMonto] = useState("");

  const configQ = useQuery({
    queryKey: ["fe-config", companyCode],
    queryFn: async () => {
      const r = await fetch(feApiUrl("/api/fe/config", companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error");
      return j.data as FeConfigResponse;
    },
    enabled: Boolean(companyCode),
  });

  const facturaQ = useQuery({
    queryKey: ["fe-factura-ref", facturaReferenciaId, companyCode],
    queryFn: async () => {
      const r = await fetch(feApiUrl(`/api/fe/facturas/${facturaReferenciaId}`, companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error");
      return j.data as FeFacturaRef;
    },
    enabled: Boolean(facturaReferenciaId) && Boolean(companyCode),
  });

  useEffect(() => {
    if (facturaQ.data?.comprobante?.claveNumerica) {
      setClaveReferencia(facturaQ.data.comprobante.claveNumerica);
    }
    if (facturaQ.data?.tipoDocumento) {
      setTipoDocReferencia(TIPO_DOC_REF[facturaQ.data.tipoDocumento] ?? "01");
    }
    if (facturaQ.data?.total && !monto) {
      setMonto(String(facturaQ.data.total));
    }
  }, [facturaQ.data, monto]);

  const puntosVenta = useMemo(
    () => configQ.data?.sucursales.flatMap((s) => s.puntosVenta.map((pv) => ({ ...pv, sucursal: s.nombre }))) ?? [],
    [configQ.data]
  );

  const totales = useMemo(() => {
    const subtotal = Number(monto) || 0;
    const totalImpuestos = 0;
    const total = subtotal;
    return {
      subtotal,
      totalImpuestos,
      total,
      detalles: [
        {
          descripcion: descripcion.trim() || "Abono",
          subTotal: subtotal,
          tarifaImpuesto: 0,
          montoImpuesto: 0,
          totalLinea: total,
        },
      ],
    };
  }, [monto, descripcion]);

  const saveM = useMutation({
    mutationFn: async () => {
      if (!puntoVentaId) throw new Error("Seleccione punto de venta");
      if (!claveReferencia.trim()) throw new Error("Indique la clave del documento de referencia");
      if (totales.total <= 0) throw new Error("Indique un monto válido");
      const body = {
        puntoVentaId,
        facturaReferenciaId: facturaReferenciaId || undefined,
        claveReferencia: claveReferencia.trim(),
        codigoReferencia: "01",
        tipoDocReferencia,
        condicionVenta,
        medioPago,
        subtotal: totales.subtotal,
        totalImpuestos: totales.totalImpuestos,
        total: totales.total,
        detalles: totales.detalles,
      };
      const r = await fetch("/api/fe/recibos-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withFeCompanyBody(body, companyCode)),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al guardar");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Recibo de pago guardado");
      void qc.invalidateQueries({ queryKey: ["fe-recibos-pago", companyCode] });
      router.push("/facturacion-electronica/recibo-pago");
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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/facturacion-electronica/recibo-pago">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">Nuevo recibo electrónico de pago</h2>
      </div>

      {facturaQ.data && (
        <p className="text-sm text-muted-foreground">
          Referencia: {facturaQ.data.cliente?.nombre} — clave{" "}
          {facturaQ.data.comprobante?.claveNumerica ?? "sin clave"}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del REP</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label>Punto de venta</Label>
            <Select value={puntoVentaId} onValueChange={setPuntoVentaId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione…" />
              </SelectTrigger>
              <SelectContent>
                {puntosVenta.map((pv) => (
                  <SelectItem key={pv.id} value={pv.id}>
                    {pv.sucursal} — {pv.codigo} {pv.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Clave documento referencia (50 dígitos)</Label>
            <Input value={claveReferencia} onChange={(e) => setClaveReferencia(e.target.value)} maxLength={50} />
          </div>
          <div className="space-y-2">
            <Label>Condición de venta (REP)</Label>
            <Select value={condicionVenta} onValueChange={setCondicionVenta}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REP_CONDICIONES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Medio de pago</Label>
            <Select value={medioPago} onValueChange={setMedioPago}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                <SelectItem value="TARJETA">Tarjeta</SelectItem>
                <SelectItem value="TRANSFERENCIA_DEPOSITO">Transferencia / depósito</SelectItem>
                <SelectItem value="SINPE_MOVIL">SINPE móvil</SelectItem>
                <SelectItem value="CHEQUE">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Monto del abono</Label>
            <Input type="number" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveM.isPending ? "Guardando…" : "Guardar borrador"}
        </Button>
      </div>
    </div>
  );
}
