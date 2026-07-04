import type { FeEmpresa, FeReciboPago, FeReciboPagoDetalle, FeComprobanteElectronico } from "@prisma/client";
import { create } from "xmlbuilder2";
import { feXmlNamespace } from "../../../constants/tipos-comprobante";
import { FE_CONDICION_VENTA_CODIGO, FE_MONEDA_CODIGO } from "../../../constants/hacienda-catalogos";
import { formatFeFechaEmisionXml } from "../../../utils/fe-fecha";
import { fmtDecimal, medioPagoCodigo, resolveMediosPago } from "../../../utils/fe-resumen";
import {
  appendEmisorReceptor,
  appendEncabezadoActividad,
  appendInformacionReferencia,
  resolveProveedorSistemas,
} from "../fe-xml-shared";

export type FeReciboPagoXmlContext = {
  empresa: FeEmpresa;
  recibo: FeReciboPago;
  detalles: FeReciboPagoDetalle[];
  comprobante: FeComprobanteElectronico;
  cliente?: { nombre: string; tipoIdentificacion: keyof typeof import("../../../constants/hacienda-catalogos").FE_IDENTIFICACION_CODIGO; identificacion: string; actividadEconomica?: string | null; direccionProvincia?: string | null; direccionCanton?: string | null; direccionDistrito?: string | null; direccionBarrio?: string | null; direccionOtras?: string | null; email?: string | null } | null;
};

function dec(value: { toString(): string } | number | string) {
  return Number(value.toString());
}

export function buildReciboPagoXml(ctx: FeReciboPagoXmlContext): string {
  const { empresa, recibo, detalles, comprobante, cliente } = ctx;
  const tipo = "RECIBO_ELECTRONICO_PAGO" as const;

  const totalImpuesto = detalles.reduce((s, d) => s + dec(d.montoImpuesto), 0);
  const totalComprobante = dec(recibo.total);
  const mediosPago = resolveMediosPago({
    medioPago: recibo.medioPago,
    medioPagoOtro: recibo.medioPagoOtro,
    totalComprobante,
  });

  const root = create({ version: "1.0", encoding: "UTF-8" }).ele("ReciboElectronicoPago", {
    xmlns: feXmlNamespace(tipo),
  });

  root.ele("Clave").txt(comprobante.claveNumerica);
  appendEncabezadoActividad({
    root,
    empresa,
    cliente: cliente as Parameters<typeof appendEncabezadoActividad>[0]["cliente"],
    proveedorSistemas: resolveProveedorSistemas(empresa),
  });
  root.ele("NumeroConsecutivo").txt(comprobante.consecutivo);
  root.ele("FechaEmision").txt(formatFeFechaEmisionXml(comprobante.fechaEmision));

  if (cliente) {
    appendEmisorReceptor({ root, empresa, cliente: cliente as NonNullable<Parameters<typeof appendEmisorReceptor>[0]["cliente"]> });
  } else {
    appendEmisorReceptor({ root, empresa, incluirReceptor: false });
  }

  root.ele("CondicionVenta").txt(FE_CONDICION_VENTA_CODIGO[recibo.condicionVenta]);

  const detalleServicio = root.ele("DetalleServicio");
  for (const [index, line] of detalles.entries()) {
    const ld = detalleServicio.ele("LineaDetalle");
    ld.ele("NumeroLinea").txt(String(line.numeroLinea || index + 1));
    ld.ele("Detalle").txt(line.descripcion.slice(0, 200));
    ld.ele("SubTotal").txt(fmtDecimal(dec(line.subTotal)));
    const imp = dec(line.montoImpuesto);
    if (imp > 0) {
      ld.ele("Impuesto")
        .ele("Codigo")
        .txt("01")
        .up()
        .ele("CodigoTarifaIVA")
        .txt("08")
        .up()
        .ele("Tarifa")
        .txt(fmtDecimal(dec(line.tarifaImpuesto), 2))
        .up()
        .ele("Monto")
        .txt(fmtDecimal(imp));
    }
    ld.ele("ImpuestoNeto").txt(fmtDecimal(imp));
    ld.ele("MontoTotalLinea").txt(fmtDecimal(dec(line.totalLinea)));
  }

  const resumenNode = root.ele("ResumenFactura");
  const moneda = FE_MONEDA_CODIGO.CRC;
  resumenNode
    .ele("CodigoTipoMoneda")
    .ele("CodigoMoneda")
    .txt(moneda.codigo)
    .up()
    .ele("TipoCambio")
    .txt(fmtDecimal(1));
  resumenNode.ele("TotalVenta").txt(fmtDecimal(dec(recibo.subtotal)));
  resumenNode.ele("TotalVentaNeta").txt(fmtDecimal(dec(recibo.subtotal)));
  if (totalImpuesto > 0) {
    resumenNode.ele("TotalImpuesto").txt(fmtDecimal(totalImpuesto));
  }
  for (const mp of mediosPago) {
    const n = resumenNode.ele("MedioPago");
    n.ele("TipoMedioPago").txt(medioPagoCodigo(mp.tipo));
    if (medioPagoCodigo(mp.tipo) === "99" && mp.otro?.trim()) {
      n.ele("MedioPagoOtros").txt(mp.otro.trim().slice(0, 100));
    }
    n.ele("TotalMedioPago").txt(fmtDecimal(mp.total));
  }
  resumenNode.ele("TotalComprobante").txt(fmtDecimal(totalComprobante));

  appendInformacionReferencia({
    root,
    tipoDoc: recibo.tipoDocReferencia,
    numero: recibo.claveReferencia,
    fechaEmision: formatFeFechaEmisionXml(recibo.fechaReferencia ?? comprobante.fechaEmision),
    codigo: recibo.codigoReferencia,
    razon: recibo.razon,
  });

  return root.end({ prettyPrint: false });
}
