"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
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

type FeConfigResponse = {
  configured: boolean;
  sucursales: Array<{
    id: string;
    codigo: string;
    nombre: string;
    puntosVenta: Array<{ id: string; codigo: string; nombre: string }>;
  }>;
};

type LineaForm = {
  key: string;
  codigoCabys: string;
  descripcion: string;
  cantidad: string;
  unidadMedida: string;
  precioUnitario: string;
  tarifaImpuesto: string;
};

const emptyLine = (): LineaForm => ({
  key: crypto.randomUUID(),
  codigoCabys: "",
  descripcion: "",
  cantidad: "1",
  unidadMedida: "Unid",
  precioUnitario: "0",
  tarifaImpuesto: "13",
});

export default function NuevaFacturaCompraPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { companyCode, needsSelection } = useFeCompany();
  const [puntoVentaId, setPuntoVentaId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [proveedorTipo, setProveedorTipo] = useState("EXTRANJERO");
  const [proveedorIdentificacion, setProveedorIdentificacion] = useState("");
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [proveedorOtrasSenas, setProveedorOtrasSenas] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<LineaForm[]>([emptyLine()]);

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

  const puntosVenta = useMemo(
    () => configQ.data?.sucursales.flatMap((s) => s.puntosVenta.map((pv) => ({ ...pv, sucursal: s.nombre }))) ?? [],
    [configQ.data]
  );

  const totales = useMemo(() => {
    let subtotal = 0;
    let totalImpuestos = 0;
    const detalles = lineas.map((l) => {
      const cantidad = Number(l.cantidad) || 0;
      const precio = Number(l.precioUnitario) || 0;
      const base = Math.round(cantidad * precio * 100) / 100;
      const tarifa = Number(l.tarifaImpuesto) || 0;
      const montoImpuesto = Math.round(base * (tarifa / 100) * 100) / 100;
      const totalLinea = Math.round((base + montoImpuesto) * 100) / 100;
      subtotal += base;
      totalImpuestos += montoImpuesto;
      return {
        codigoCabys: l.codigoCabys.replace(/\D/g, ""),
        descripcion: l.descripcion.trim(),
        cantidad,
        unidadMedida: l.unidadMedida.trim() || "Unid",
        precioUnitario: precio,
        tarifaImpuesto: tarifa,
        montoImpuesto,
        totalLinea,
      };
    });
    const total = Math.round((subtotal + totalImpuestos) * 100) / 100;
    return { subtotal, totalImpuestos, total, detalles };
  }, [lineas]);

  const saveM = useMutation({
    mutationFn: async () => {
      if (!puntoVentaId) throw new Error("Seleccione punto de venta");
      if (!proveedorIdentificacion.trim() || !proveedorNombre.trim()) {
        throw new Error("Complete datos del proveedor");
      }
      if (totales.detalles.some((d) => !d.descripcion || d.cantidad <= 0 || d.codigoCabys.length !== 13)) {
        throw new Error("Complete las líneas: descripción, cantidad y CABYS (13 dígitos)");
      }
      const body = {
        puntoVentaId,
        fecha: new Date(fecha).toISOString(),
        condicionVenta: "CONTADO",
        proveedorTipoIdentificacion: proveedorTipo,
        proveedorIdentificacion: proveedorIdentificacion.trim(),
        proveedorNombre: proveedorNombre.trim(),
        proveedorOtrasSenasExtranjero:
          proveedorTipo === "EXTRANJERO" ? proveedorOtrasSenas.trim() || undefined : undefined,
        observaciones: observaciones.trim() || undefined,
        subtotal: totales.subtotal,
        totalImpuestos: totales.totalImpuestos,
        total: totales.total,
        detalles: totales.detalles,
      };
      const r = await fetch("/api/fe/facturas-compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withFeCompanyBody(body, companyCode)),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al guardar");
      return j.data as { id: string };
    },
    onSuccess: (row) => {
      toast.success("Factura de compra guardada");
      void qc.invalidateQueries({ queryKey: ["fe-facturas-compra", companyCode] });
      router.push("/facturacion-electronica/compra");
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
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/facturacion-electronica/compra">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">Nueva factura electrónica de compra</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos generales</CardTitle>
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
                    {pv.sucursal} — {pv.codigo} {pv.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo identificación proveedor</Label>
            <Select value={proveedorTipo} onValueChange={setProveedorTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXTRANJERO">Extranjero</SelectItem>
                <SelectItem value="NO_CONTRIBUYENTE">No contribuyente</SelectItem>
                <SelectItem value="FISICA">Física</SelectItem>
                <SelectItem value="JURIDICA">Jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Identificación proveedor</Label>
            <Input value={proveedorIdentificacion} onChange={(e) => setProveedorIdentificacion(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nombre proveedor</Label>
            <Input value={proveedorNombre} onChange={(e) => setProveedorNombre(e.target.value)} />
          </div>
          {proveedorTipo === "EXTRANJERO" && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Otras señas (extranjero)</Label>
              <Textarea value={proveedorOtrasSenas} onChange={(e) => setProveedorOtrasSenas(e.target.value)} />
            </div>
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label>Observaciones</Label>
            <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Líneas</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setLineas((p) => [...p, emptyLine()])}>
            <Plus className="mr-1 h-4 w-4" />
            Línea
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineas.map((line, idx) => (
            <div key={line.key} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between">
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
                  <Label>Código CABYS (13 dígitos)</Label>
                  <Input
                    value={line.codigoCabys}
                    placeholder="8511000000001"
                    maxLength={13}
                    onChange={(e) =>
                      setLineas((p) =>
                        p.map((l) =>
                          l.key === line.key ? { ...l, codigoCabys: e.target.value.replace(/\D/g, "") } : l
                        )
                      )
                    }
                  />
                </div>
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
                    value={line.precioUnitario}
                    onChange={(e) =>
                      setLineas((p) =>
                        p.map((l) => (l.key === line.key ? { ...l, precioUnitario: e.target.value } : l))
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tarifa IVA %</Label>
                  <Input
                    type="number"
                    min={0}
                    value={line.tarifaImpuesto}
                    onChange={(e) =>
                      setLineas((p) =>
                        p.map((l) => (l.key === line.key ? { ...l, tarifaImpuesto: e.target.value } : l))
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
          <div className="text-sm">
            <p>Subtotal: {totales.subtotal.toLocaleString("es-CR")}</p>
            <p>Impuestos: {totales.totalImpuestos.toLocaleString("es-CR")}</p>
            <p className="text-lg font-semibold">Total: {totales.total.toLocaleString("es-CR")}</p>
          </div>
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {saveM.isPending ? "Guardando…" : "Guardar borrador"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
