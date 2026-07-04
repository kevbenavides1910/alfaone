import type {
  FeEmpresa,
  FeFacturaCompra,
  FeFacturaCompraDetalle,
  FeComprobanteElectronico,
} from "@prisma/client";
import { create } from "xmlbuilder2";
import { feXmlNamespace } from "../../../constants/tipos-comprobante";
import { actividadForXml } from "../../../utils/hacienda-actividad";
import { formatFeFechaEmisionXml } from "../../../utils/fe-fecha";
import { calcularResumen, resolveMediosPago } from "../../../utils/fe-resumen";
import {
  appendCondicionVenta,
  appendDetalleServicio,
  appendEmisorReceptorCompra,
  appendEncabezadoActividad,
  appendInformacionReferencia,
  appendResumenFacturaV44,
  resolveProveedorSistemas,
  type FeLineaXmlInput,
} from "../fe-xml-shared";

export type FeFacturaCompraXmlContext = {
  empresa: FeEmpresa;
  factura: FeFacturaCompra;
  detalles: FeFacturaCompraDetalle[];
  comprobante: FeComprobanteElectronico;
};

function dec(value: { toString(): string } | number | string) {
  return Number(value.toString());
}

export function buildFacturaCompraXml(ctx: FeFacturaCompraXmlContext): string {
  const { empresa, factura, detalles, comprobante } = ctx;
  const tipo = "FACTURA_ELECTRONICA_COMPRA" as const;

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

  const resumen = calcularResumen(lineasInput, { totalComprobanteOverride: dec(factura.total) });
  const mediosPago = resolveMediosPago({
    medioPago: "TRANSFERENCIA_DEPOSITO",
    totalComprobante: resumen.totalComprobante,
  });

  const root = create({ version: "1.0", encoding: "UTF-8" }).ele("FacturaElectronicaCompra", {
    xmlns: feXmlNamespace(tipo),
  });

  root.ele("Clave").txt(comprobante.claveNumerica);
  root.ele("ProveedorSistemas").txt(resolveProveedorSistemas(empresa));
  root.ele("CodigoActividadReceptor").txt(actividadForXml(empresa.actividadEconomica));
  root.ele("NumeroConsecutivo").txt(comprobante.consecutivo);
  root.ele("FechaEmision").txt(formatFeFechaEmisionXml(comprobante.fechaEmision));

  appendEmisorReceptorCompra({
    root,
    empresa,
    proveedor: {
      tipoIdentificacion: factura.proveedorTipoIdentificacion,
      identificacion: factura.proveedorIdentificacion,
      nombre: factura.proveedorNombre,
      otrasSenasExtranjero: factura.proveedorOtrasSenasExtranjero,
    },
  });

  appendCondicionVenta({ root, condicionVenta: factura.condicionVenta });

  const lineasXml: FeLineaXmlInput[] = detalles.map((line, index) => ({
    numeroLinea: line.numeroLinea || index + 1,
    codigoCabys: line.codigoCabys,
    descripcion: line.descripcion,
    unidadMedida: line.unidadMedida,
    montoDescuento: dec(line.montoDescuento),
    calculada: resumen.lineas[index]!,
    montoImpuesto: dec(line.montoImpuesto),
    totalLinea: dec(line.totalLinea),
    tarifaImpuesto: dec(line.tarifaImpuesto),
    permitirExoneracion: false,
  }));
  appendDetalleServicio(root, lineasXml);

  appendResumenFacturaV44({
    root,
    moneda: factura.moneda,
    tipoCambio: dec(factura.tipoCambio),
    resumen,
    mediosPago,
  });

  if (factura.claveReferencia?.trim()) {
    appendInformacionReferencia({
      root,
      tipoDoc: "16",
      numero: factura.claveReferencia,
      fechaEmision: formatFeFechaEmisionXml(factura.fecha),
      codigo: factura.codigoReferencia,
      razon: "Comprobante proveedor no domiciliado",
    });
  }

  if (factura.observaciones?.trim()) {
    root.ele("Otros").ele("OtroTexto").txt(factura.observaciones.trim().slice(0, 500));
  }

  return root.end({ prettyPrint: false });
}
