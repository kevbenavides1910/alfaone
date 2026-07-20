"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Send, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import {
  feApiUrl,
  useFeCompany,
  withFeCompanyBody,
} from "@/components/facturacion-electronica/fe-company-context";
import { lineTotals, type LineaForm } from "@/modules/facturacion-electronica/business/line-totals";

type ReferenciaTipo = "FACTURA_VENTA" | "FACTURA_COMPRA" | "RECIBO_PAGO";

type DocumentoRef = {
  id: string;
  estado?: string;
  subtotal: string | number;
  totalImpuestos: string | number;
  totalDescuentos?: string | number;
  total: string | number;
  detalles: Array<{
    descripcion: string;
    cantidad?: string | number;
    unidadMedida?: string;
    precioUnitario?: string | number;
    subTotal?: string | number;
    montoDescuento?: string | number;
    tarifaImpuesto?: string | number;
    montoImpuesto?: string | number;
    totalLinea: string | number;
    codigoCabys?: string | null;
  }>;
};

function mapDetalleToLine(d: DocumentoRef["detalles"][0], key: string, referenciaTipo: ReferenciaTipo): LineaForm {
  if (referenciaTipo === "RECIBO_PAGO") {
    const sub = Number(d.subTotal ?? d.totalLinea ?? 0);
    return {
      key,
      descripcion: d.descripcion,
      cantidad: "1",
      unidadMedida: "Unid",
      precioUnitario: String(sub),
      montoDescuento: "0",
      tarifaImpuesto: String(d.tarifaImpuesto ?? 13),
      codigoCabys: "",
    };
  }
  return {
    key,
    descripcion: d.descripcion,
    cantidad: String(d.cantidad ?? 1),
    unidadMedida: d.unidadMedida ?? "Unid",
    precioUnitario: String(d.precioUnitario ?? 0),
    montoDescuento: String(d.montoDescuento ?? 0),
    tarifaImpuesto: String(d.tarifaImpuesto ?? 13),
    codigoCabys: (d.codigoCabys ?? "").replace(/\D/g, ""),
  };
}

function documentoApiUrl(referenciaTipo: ReferenciaTipo, documentoId: string) {
  if (referenciaTipo === "FACTURA_COMPRA") return `/api/fe/facturas-compra/${documentoId}`;
  if (referenciaTipo === "RECIBO_PAGO") return `/api/fe/recibos-pago/${documentoId}`;
  return `/api/fe/facturas/${documentoId}`;
}

export function FeNotaForm({
  documentoId,
  referenciaTipo = "FACTURA_VENTA",
  backHref,
  tipo,
  titulo,
}: {
  documentoId: string;
  referenciaTipo?: ReferenciaTipo;
  backHref: string;
  tipo: "credito" | "debito";
  titulo: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { companyCode } = useFeCompany();
  const apiBase = tipo === "credito" ? "/api/fe/notas-credito" : "/api/fe/notas-debito";

  const [razon, setRazon] = useState("");
  const [codigoReferencia, setCodigoReferencia] = useState("01");
  const [enviarAlGuardar, setEnviarAlGuardar] = useState(true);
  const [lineas, setLineas] = useState<LineaForm[]>([]);

  const documentoQ = useQuery({
    queryKey: ["fe-nota-ref", referenciaTipo, documentoId, companyCode],
    queryFn: async (): Promise<DocumentoRef> => {
      const r = await fetch(feApiUrl(documentoApiUrl(referenciaTipo, documentoId), companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar documento de referencia");
      return j.data;
    },
    enabled: Boolean(documentoId),
  });

  useEffect(() => {
    if (documentoQ.data?.detalles?.length && lineas.length === 0) {
      setLineas(documentoQ.data.detalles.map((d, i) => mapDetalleToLine(d, `line-${i}`, referenciaTipo)));
    }
  }, [documentoQ.data, lineas.length, referenciaTipo]);

  const totales = useMemo(() => {
    let subtotal = 0;
    let totalImpuestos = 0;
    let totalDescuentos = 0;
    const detalles = lineas.map((l) => {
      const { base, montoImpuesto, totalLinea } = lineTotals(l);
      subtotal += base;
      totalImpuestos += montoImpuesto;
      totalDescuentos += Number(l.montoDescuento) || 0;
      return {
        codigoCabys: l.codigoCabys || undefined,
        descripcion: l.descripcion.trim(),
        cantidad: Number(l.cantidad) || 0,
        unidadMedida: l.unidadMedida.trim() || "Unid",
        precioUnitario: Number(l.precioUnitario) || 0,
        montoDescuento: Number(l.montoDescuento) || 0,
        codigoImpuesto: "08",
        tarifaImpuesto: Number(l.tarifaImpuesto) || 13,
        montoImpuesto,
        totalLinea,
      };
    });
    const total = Math.round((subtotal + totalImpuestos) * 100) / 100;
    return { subtotal, totalImpuestos, totalDescuentos, total, detalles };
  }, [lineas]);

  const saveM = useMutation({
    mutationFn: async () => {
      if (!razon.trim()) throw new Error("Indique la razón de la nota");
      if (totales.detalles.some((d) => !d.descripcion || d.cantidad <= 0)) {
        throw new Error("Complete las líneas de detalle");
      }
      const body = {
        referenciaTipo,
        ...(referenciaTipo === "FACTURA_VENTA" && { facturaReferenciaId: documentoId }),
        ...(referenciaTipo === "FACTURA_COMPRA" && { facturaCompraReferenciaId: documentoId }),
        ...(referenciaTipo === "RECIBO_PAGO" && { reciboPagoReferenciaId: documentoId }),
        razon: razon.trim(),
        codigoReferencia,
        subtotal: totales.subtotal,
        totalDescuentos: totales.totalDescuentos,
        totalImpuestos: totales.totalImpuestos,
        total: totales.total,
        detalles: totales.detalles,
      };
      const r = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withFeCompanyBody(body, companyCode)),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al crear nota");
      const notaId = j.data.id as string;
      if (enviarAlGuardar) {
        const r2 = await fetch(feApiUrl(`${apiBase}/${notaId}`, companyCode), { method: "POST" });
        const j2 = await r2.json();
        if (!r2.ok) throw new Error(j2.error?.message ?? "Nota creada pero falló el envío a Hacienda");
      }
      return { notaId, enviada: enviarAlGuardar };
    },
    onSuccess: ({ notaId, enviada }) => {
      toast.success(enviada ? "Nota enviada a Hacienda" : "Nota guardada en borrador");
      void qc.invalidateQueries({ queryKey: ["fe-nota-ref", referenciaTipo, documentoId] });
      if (enviada) {
        router.push(
          tipo === "credito"
            ? `/facturacion-electronica/notas-credito/${notaId}`
            : `/facturacion-electronica/notas-debito/${notaId}`
        );
      } else {
        router.push(backHref);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (documentoQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando documento de referencia…</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">{titulo}</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referencia y motivo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Razón (Hacienda)</Label>
            <Textarea value={razon} onChange={(e) => setRazon(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Código referencia</Label>
            <Select value={codigoReferencia} onValueChange={setCodigoReferencia}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="01">01 — Anula documento</SelectItem>
                <SelectItem value="02">02 — Corrige texto</SelectItem>
                <SelectItem value="04">04 — Referencia otro documento</SelectItem>
                <SelectItem value="99">99 — Otros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="enviar-nota"
              type="checkbox"
              checked={enviarAlGuardar}
              onChange={(e) => setEnviarAlGuardar(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="enviar-nota">Enviar a Hacienda al guardar</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Detalle</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setLineas((p) => [
                ...p,
                mapDetalleToLine(
                  {
                    descripcion: "",
                    cantidad: 1,
                    unidadMedida: "Unid",
                    precioUnitario: 0,
                    montoDescuento: 0,
                    tarifaImpuesto: 13,
                    montoImpuesto: 0,
                    totalLinea: 0,
                  },
                  crypto.randomUUID(),
                  referenciaTipo
                ),
              ])
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Línea
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineas.map((line, idx) => (
            <div key={line.key} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Línea {idx + 1}</span>
                {lineas.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLineas((p) => p.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Descripción</Label>
                  <Input
                    value={line.descripcion}
                    onChange={(e) =>
                      setLineas((p) => p.map((l) => (l.key === line.key ? { ...l, descripcion: e.target.value } : l)))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={line.cantidad}
                    onChange={(e) =>
                      setLineas((p) => p.map((l) => (l.key === line.key ? { ...l, cantidad: e.target.value } : l)))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Precio unitario</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={line.precioUnitario}
                    onChange={(e) =>
                      setLineas((p) =>
                        p.map((l) => (l.key === line.key ? { ...l, precioUnitario: e.target.value } : l))
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <p className="text-lg font-semibold">Total: {totales.total.toLocaleString("es-CR")}</p>
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            {enviarAlGuardar ? <Send className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            {saveM.isPending ? "Procesando…" : enviarAlGuardar ? "Crear y enviar" : "Guardar borrador"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
