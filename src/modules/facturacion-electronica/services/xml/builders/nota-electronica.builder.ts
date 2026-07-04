import type {
  FeCliente,
  FeEmpresa,
  FeComprobanteElectronico,
  FeNotaCredito,
  FeNotaCreditoDetalle,
  FeNotaDebito,
  FeNotaDebitoDetalle,
} from "@prisma/client";
import { formatFeFechaEmisionXml } from "../../../utils/fe-fecha";
import { calcularResumen, resolveMediosPago } from "../../../utils/fe-resumen";
import type { FeNotaReferenciaSnapshot } from "../../../utils/fe-nota-referencia";
import { create } from "xmlbuilder2";
import {
  appendCondicionVenta,
  appendDetalleServicio,
  appendEmisorReceptor,
  appendEncabezadoActividad,
  appendInformacionReferencia,
  appendResumenFacturaV44,
  resolveProveedorSistemas,
  type FeLineaXmlInput,
} from "../fe-xml-shared";

type NotaKind = "NOTA_CREDITO" | "NOTA_DEBITO";

const NS: Record<NotaKind, { root: string; xmlns: string }> = {
  NOTA_CREDITO: {
    root: "NotaCreditoElectronica",
    xmlns: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaCreditoElectronica",
  },
  NOTA_DEBITO: {
    root: "NotaDebitoElectronica",
    xmlns: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaDebitoElectronica",
  },
};

type NotaDetalle = FeNotaCreditoDetalle | FeNotaDebitoDetalle;

export type FeNotaXmlContext = {
  kind: NotaKind;
  empresa: FeEmpresa;
  referencia: FeNotaReferenciaSnapshot;
  comprobante: FeComprobanteElectronico;
  nota: FeNotaCredito | FeNotaDebito;
  detalles: NotaDetalle[];
  codigoReferencia: string;
};

function dec(value: { toString(): string } | number | string) {
  return Number(value.toString());
}

function receptorAsCliente(referencia: FeNotaReferenciaSnapshot): FeCliente | null {
  if (!referencia.receptor) return null;
  const r = referencia.receptor;
  return {
    id: "nota-receptor-synthetic",
    empresaId: "",
    tipoIdentificacion: r.tipoIdentificacion,
    identificacion: r.identificacion,
    nombre: r.nombre,
    nombreComercial: null,
    actividadEconomica: r.actividadEconomica ?? null,
    email: r.email ?? null,
    emailCopia: null,
    telefono: null,
    direccionProvincia: r.direccionProvincia ?? null,
    direccionCanton: r.direccionCanton ?? null,
    direccionDistrito: r.direccionDistrito ?? null,
    direccionBarrio: r.direccionBarrio ?? null,
    direccionOtras: r.direccionOtras ?? null,
    externalRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdById: null,
    updatedById: null,
  };
}

function buildLineasXml(detalles: NotaDetalle[], resumen: ReturnType<typeof calcularResumen>): FeLineaXmlInput[] {
  return detalles.map((line, index) => ({
    numeroLinea: line.numeroLinea || index + 1,
    codigoCabys: line.codigoCabys,
    codigo: line.codigo,
    descripcion: line.descripcion,
    unidadMedida: line.unidadMedida,
    montoDescuento: dec(line.montoDescuento),
    codigoDescuento: "99",
    naturalezaDescuento: dec(line.montoDescuento) > 0 ? "Ajuste nota" : null,
    calculada: resumen.lineas[index]!,
    montoImpuesto: dec(line.montoImpuesto),
    totalLinea: dec(line.totalLinea),
    tarifaImpuesto: dec(line.tarifaImpuesto),
    permitirExoneracion: true,
  }));
}

export function buildNotaElectronicaXml(ctx: FeNotaXmlContext): string {
  const { kind, empresa, referencia, comprobante, nota, detalles, codigoReferencia } = ctx;
  const meta = NS[kind];
  const cliente = receptorAsCliente(referencia);

  const lineasInput = detalles.map((line) => ({
    cantidad: dec(line.cantidad),
    precioUnitario: dec(line.precioUnitario),
    montoDescuento: dec(line.montoDescuento),
    codigoCabys: line.codigoCabys,
    codigoTarifa: line.codigoImpuesto,
    tarifaImpuesto: dec(line.tarifaImpuesto),
    montoImpuesto: dec(line.montoImpuesto),
    totalLinea: dec(line.totalLinea),
  }));

  const resumen = calcularResumen(lineasInput, {
    totalComprobanteOverride: dec(nota.total),
    totalOtrosCargos: referencia.totalOtrosCargos,
    otrosCargos: referencia.otrosCargos,
    totalIvaDevuelto: referencia.totalIvaDevuelto,
  });

  const mediosPago = resolveMediosPago({
    medioPago: referencia.medioPago,
    medioPagoOtro: referencia.medioPagoOtro,
    mediosPago: referencia.mediosPago,
    totalComprobante: resumen.totalComprobante,
  });

  const root = create({ version: "1.0", encoding: "UTF-8" }).ele(meta.root, { xmlns: meta.xmlns });

  root.ele("Clave").txt(comprobante.claveNumerica);
  appendEncabezadoActividad({
    root,
    empresa,
    cliente,
    proveedorSistemas: resolveProveedorSistemas(empresa),
  });
  root.ele("NumeroConsecutivo").txt(comprobante.consecutivo);
  root.ele("FechaEmision").txt(formatFeFechaEmisionXml(comprobante.fechaEmision));
  appendEmisorReceptor({
    root,
    empresa,
    cliente,
    incluirReceptor: Boolean(cliente),
  });

  appendCondicionVenta({
    root,
    condicionVenta: referencia.condicionVenta,
    condicionVentaOtro: referencia.condicionVentaOtro,
    plazoCredito: referencia.plazoCredito,
  });

  appendDetalleServicio(root, buildLineasXml(detalles, resumen));

  appendResumenFacturaV44({
    root,
    moneda: referencia.moneda,
    tipoCambio: referencia.tipoCambio,
    resumen,
    mediosPago,
  });

  appendInformacionReferencia({
    root,
    tipoDoc: referencia.tipoDocReferencia,
    numero: nota.claveReferencia,
    fechaEmision: formatFeFechaEmisionXml(referencia.fechaReferencia),
    codigo: codigoReferencia,
    razon: nota.razon,
  });

  return root.end({ prettyPrint: false });
}

export function buildNotaCreditoXml(ctx: Omit<FeNotaXmlContext, "kind">) {
  return buildNotaElectronicaXml({ ...ctx, kind: "NOTA_CREDITO" });
}

export function buildNotaDebitoXml(ctx: Omit<FeNotaXmlContext, "kind">) {
  return buildNotaElectronicaXml({ ...ctx, kind: "NOTA_DEBITO" });
}
