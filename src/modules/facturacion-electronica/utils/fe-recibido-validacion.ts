import { isValidFeClave } from "../services/incoming/factura-recibida.parser";

/** Tipos XML que corresponden a comprobantes de proveedor (no mensajes ni confirmaciones). */
export const TIPOS_COMPROBANTE_RECIBIDO = new Set([
  "FacturaElectronica",
  "FacturaElectronicaCompra",
  "FacturaElectronicaExportacion",
  "TiqueteElectronico",
  "NotaCreditoElectronica",
  "NotaDebitoElectronica",
]);

export type FeRecibidoValidacionRow = {
  xmlPath?: string | null;
  clave?: string | null;
  cedulaEmisor?: string | null;
  parsedJson?: unknown;
  estado?: string;
};

function digits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function isComprobanteRecibidoValido(
  row: FeRecibidoValidacionRow,
  empresaCedula?: string | null
): boolean {
  if (!row.xmlPath?.trim()) return false;
  if (!isValidFeClave(row.clave)) return false;

  const cedulaEmisor = digits(row.cedulaEmisor);
  if (cedulaEmisor.length < 9) return false;

  const cedulaEmpresa = digits(empresaCedula);
  if (cedulaEmpresa && cedulaEmisor === cedulaEmpresa) return false;

  const parsed = row.parsedJson as { tipoComprobante?: string } | null | undefined;
  const tipo = parsed?.tipoComprobante?.trim();
  if (!tipo || !TIPOS_COMPROBANTE_RECIBIDO.has(tipo)) return false;

  return true;
}

export function motivoRecibidoInvalido(
  row: FeRecibidoValidacionRow,
  empresaCedula?: string | null
): string | null {
  if (isComprobanteRecibidoValido(row, empresaCedula)) return null;
  if (!row.xmlPath?.trim()) return "Sin XML de factura electrónica";
  if (!isValidFeClave(row.clave)) return "Clave FE inválida o ausente";
  const cedulaEmisor = digits(row.cedulaEmisor);
  if (cedulaEmisor.length < 9) return "Sin cédula del emisor";
  const cedulaEmpresa = digits(empresaCedula);
  if (cedulaEmpresa && cedulaEmisor === cedulaEmpresa) return "Comprobante emitido por la propia empresa";
  const parsed = row.parsedJson as { tipoComprobante?: string } | null | undefined;
  const tipo = parsed?.tipoComprobante?.trim();
  if (!tipo) return "Tipo de comprobante no identificado";
  if (!TIPOS_COMPROBANTE_RECIBIDO.has(tipo)) return `Tipo no admitido: ${tipo}`;
  return "No es una factura electrónica válida";
}
