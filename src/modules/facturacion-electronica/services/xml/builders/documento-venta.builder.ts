import type {
  FeCliente,
  FeComprobanteTipo,
  FeEmpresa,
  FeFactura,
  FeFacturaDetalle,
  FeComprobanteElectronico,
  FePuntoVenta,
  FeSucursal,
} from "@prisma/client";
import { create } from "xmlbuilder2";
import { FE_XML_ROOT_BY_TIPO, feXmlNamespace } from "../../../constants/tipos-comprobante";
import { formatFeFechaEmisionXml } from "../../../utils/fe-fecha";
import { calcularResumen, resolveMediosPago } from "../../../utils/fe-resumen";
import {
  appendCondicionVenta,
  appendDetalleServicio,
  appendEmisorReceptor,
  appendEncabezadoActividad,
  appendOtrosCargos,
  appendResumenFacturaV44,
  buildLineaXmlFromDetalle,
  mapDetalleToLineaInput,
  resolveProveedorSistemas,
} from "../fe-xml-shared";

export type FeDocumentoVentaXmlContext = {
  tipoDocumento: Extract<
    FeComprobanteTipo,
    "FACTURA_ELECTRONICA" | "TIQUETE_ELECTRONICO" | "FACTURA_ELECTRONICA_EXPORTACION"
  >;
  empresa: FeEmpresa;
  factura: FeFactura;
  detalles: FeFacturaDetalle[];
  cliente: FeCliente | null;
  comprobante: FeComprobanteElectronico;
  puntoVenta: FePuntoVenta & { sucursal: FeSucursal };
};

function dec(value: { toString(): string } | number | string) {
  return Number(value.toString());
}

export function buildDocumentoVentaXml(ctx: FeDocumentoVentaXmlContext): string {
  const { empresa, factura, detalles, cliente, comprobante, tipoDocumento } = ctx;
  const rootName = FE_XML_ROOT_BY_TIPO[tipoDocumento]!;
  const esExportacion = tipoDocumento === "FACTURA_ELECTRONICA_EXPORTACION";
  const esTiquete = tipoDocumento === "TIQUETE_ELECTRONICO";

  const lineasInput = detalles.map(mapDetalleToLineaInput);
  const resumen = calcularResumen(lineasInput, {
    totalComprobanteOverride: dec(factura.total),
    totalOtrosCargos: dec(factura.totalOtrosCargos),
    otrosCargos: factura.otrosCargos,
    totalIvaDevuelto: dec(factura.totalIvaDevuelto),
  });

  const mediosPago = resolveMediosPago({
    medioPago: factura.medioPago,
    medioPagoOtro: factura.medioPagoOtro,
    mediosPago: factura.mediosPago,
    totalComprobante: resumen.totalComprobante,
  });

  const root = create({ version: "1.0", encoding: "UTF-8" }).ele(rootName, {
    xmlns: feXmlNamespace(tipoDocumento),
  });

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
    incluirReceptor: !esTiquete || Boolean(cliente),
  });

  appendCondicionVenta({
    root,
    condicionVenta: factura.condicionVenta,
    condicionVentaOtro: factura.condicionVentaOtro,
    plazoCredito: factura.plazoCredito,
  });

  const lineasXml = detalles.map((line, index) => {
    const built = buildLineaXmlFromDetalle(line, index, resumen.lineas[index]!);
    return {
      ...built,
      permitirExoneracion: !esExportacion,
    };
  });
  appendDetalleServicio(root, lineasXml);

  if (resumen.otrosCargos.length > 0) {
    appendOtrosCargos(root, resumen.otrosCargos);
  }

  appendResumenFacturaV44({
    root,
    moneda: factura.moneda,
    tipoCambio: dec(factura.tipoCambio),
    resumen,
    mediosPago,
  });

  if (factura.observaciones?.trim()) {
    root.ele("Otros").ele("OtroTexto").txt(factura.observaciones.trim().slice(0, 500));
  }

  return root.end({ prettyPrint: false });
}

export function buildFacturaElectronicaXml(ctx: Omit<FeDocumentoVentaXmlContext, "tipoDocumento"> & { cliente: FeCliente }) {
  return buildDocumentoVentaXml({ ...ctx, tipoDocumento: "FACTURA_ELECTRONICA" });
}

export function buildTiqueteElectronicoXml(ctx: Omit<FeDocumentoVentaXmlContext, "tipoDocumento">) {
  return buildDocumentoVentaXml({ ...ctx, tipoDocumento: "TIQUETE_ELECTRONICO" });
}

export function buildFacturaExportacionXml(ctx: Omit<FeDocumentoVentaXmlContext, "tipoDocumento"> & { cliente: FeCliente }) {
  return buildDocumentoVentaXml({ ...ctx, tipoDocumento: "FACTURA_ELECTRONICA_EXPORTACION" });
}
