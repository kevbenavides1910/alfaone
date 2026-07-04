import { DOMParser } from "@xmldom/xmldom";

type XmlDocument = ReturnType<DOMParser["parseFromString"]>;
import type { FeMoneda } from "@prisma/client";
import { codigoTarifaToPercent } from "../../utils/fe-tarifa-iva";
import { isFeComprobanteXml, parseFacturaRecibidaXml } from "./factura-recibida.parser";

export type FeGastoImpuestoParsed = {
  codigoImpuesto: string;
  codigoTarifaIVA: string;
  tarifaPercent: number;
  montoImpuesto: number;
};

export type FeGastoRecibidoParsed = {
  clave: string;
  cedulaEmisor: string;
  nombreEmisor: string | null;
  consecutivo: string | null;
  fechaEmision: Date;
  tipoComprobante: string | null;
  moneda: FeMoneda;
  tipoCambio: number;
  subtotal: number;
  totalDescuentos: number;
  totalImpuestos: number;
  total: number;
  impuestos: FeGastoImpuestoParsed[];
};

function textOf(doc: XmlDocument, tag: string): string | null {
  const nodes = doc.getElementsByTagName(tag);
  if (!nodes.length) return null;
  const value = nodes.item(0)?.textContent?.trim();
  return value || null;
}

function numOf(doc: XmlDocument, tag: string): number | null {
  const raw = textOf(doc, tag);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseFecha(raw: string | null): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseMoneda(doc: XmlDocument): FeMoneda {
  const codigo = textOf(doc, "CodigoMoneda")?.toUpperCase();
  if (codigo === "USD" || codigo === "EUR") return codigo;
  return "CRC";
}

function parseDesgloseResumen(doc: XmlDocument): FeGastoImpuestoParsed[] {
  const nodes = doc.getElementsByTagName("TotalDesgloseImpuesto");
  const result: FeGastoImpuestoParsed[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes.item(i);
    if (!node) continue;
    const codigo =
      node.getElementsByTagName("Codigo").item(0)?.textContent?.trim() || "01";
    const codigoTarifaIVA =
      node.getElementsByTagName("CodigoTarifaIVA").item(0)?.textContent?.trim() || "08";
    const montoRaw = node.getElementsByTagName("TotalMontoImpuesto").item(0)?.textContent?.trim();
    const montoImpuesto = montoRaw ? Number(montoRaw) : 0;
    if (!Number.isFinite(montoImpuesto) || montoImpuesto <= 0) continue;

    result.push({
      codigoImpuesto: codigo,
      codigoTarifaIVA,
      tarifaPercent: codigoTarifaToPercent(codigoTarifaIVA),
      montoImpuesto,
    });
  }

  return result;
}

function parseDesgloseLineas(doc: XmlDocument): FeGastoImpuestoParsed[] {
  const map = new Map<string, FeGastoImpuestoParsed>();
  const lineas = doc.getElementsByTagName("LineaDetalle");

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas.item(i);
    if (!linea) continue;
    const impuestos = linea.getElementsByTagName("Impuesto");
    for (let j = 0; j < impuestos.length; j++) {
      const imp = impuestos.item(j);
      if (!imp) continue;
      const codigo = imp.getElementsByTagName("Codigo").item(0)?.textContent?.trim() || "01";
      const codigoTarifaIVA =
        imp.getElementsByTagName("CodigoTarifaIVA").item(0)?.textContent?.trim() || "08";
      const tarifaRaw = imp.getElementsByTagName("Tarifa").item(0)?.textContent?.trim();
      const tarifaPercent = tarifaRaw ? Number(tarifaRaw) : codigoTarifaToPercent(codigoTarifaIVA);
      const montoRaw = imp.getElementsByTagName("Monto").item(0)?.textContent?.trim();
      const monto = montoRaw ? Number(montoRaw) : 0;
      if (!Number.isFinite(monto) || monto <= 0) continue;

      const key = `${codigo}:${codigoTarifaIVA}:${tarifaPercent}`;
      const prev = map.get(key);
      if (prev) {
        prev.montoImpuesto += monto;
      } else {
        map.set(key, {
          codigoImpuesto: codigo,
          codigoTarifaIVA,
          tarifaPercent: Number.isFinite(tarifaPercent) ? tarifaPercent : codigoTarifaToPercent(codigoTarifaIVA),
          montoImpuesto: monto,
        });
      }
    }
  }

  return [...map.values()];
}

export function parseGastoFromRecibidoXml(xml: string): FeGastoRecibidoParsed | null {
  if (!isFeComprobanteXml(xml)) return null;

  const header = parseFacturaRecibidaXml(xml);
  if (!header) return null;

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const fechaEmision = header.fechaEmision ?? parseFecha(textOf(doc, "FechaEmision"));
  if (!fechaEmision) return null;

  const totalVentaNeta = numOf(doc, "TotalVentaNeta");
  const totalVenta = numOf(doc, "TotalVenta");
  const subtotal = totalVentaNeta ?? totalVenta ?? header.montoTotal ?? 0;
  const totalDescuentos = numOf(doc, "TotalDescuentos") ?? 0;
  const totalImpuestos = numOf(doc, "TotalImpuesto") ?? header.montoTotalImpuesto ?? 0;
  const total = numOf(doc, "TotalComprobante") ?? header.montoTotal ?? subtotal + totalImpuestos;
  const tipoCambio = numOf(doc, "TipoCambio") ?? 1;

  let impuestos = parseDesgloseResumen(doc);
  if (!impuestos.length) {
    impuestos = parseDesgloseLineas(doc);
  }
  if (!impuestos.length && totalImpuestos > 0) {
    impuestos = [
      {
        codigoImpuesto: "01",
        codigoTarifaIVA: "08",
        tarifaPercent: 13,
        montoImpuesto: totalImpuestos,
      },
    ];
  }

  return {
    clave: header.clave,
    cedulaEmisor: header.cedulaEmisor,
    nombreEmisor: header.nombreEmisor,
    consecutivo: header.consecutivo,
    fechaEmision,
    tipoComprobante: header.tipoComprobante,
    moneda: parseMoneda(doc),
    tipoCambio,
    subtotal,
    totalDescuentos,
    totalImpuestos,
    total,
    impuestos,
  };
}
