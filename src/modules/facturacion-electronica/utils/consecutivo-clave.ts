/** Tipos de comprobante que reciben consecutivo al crear un punto de venta. */
import { feCalendarParts } from "./fe-fecha";

export const FE_CONSECUTIVO_TIPOS = [
  "FACTURA_ELECTRONICA",
  "NOTA_DEBITO",
  "NOTA_CREDITO",
  "TIQUETE_ELECTRONICO",
  "MENSAJE_RECEPTOR",
  "FACTURA_ELECTRONICA_EXPORTACION",
  "FACTURA_ELECTRONICA_COMPRA",
  "RECIBO_ELECTRONICO_PAGO",
] as const;

export type FeConsecutivoTipo = (typeof FE_CONSECUTIVO_TIPOS)[number];
export type FeClaveSituacion = "1" | "2" | "3";

export function resolveClaveSituacion(
  raw?: string | null,
  ambiente?: "STAGING" | "PRODUCCION" | null
): FeClaveSituacion {
  const v = raw?.trim();
  if (v === "1" || v === "2" || v === "3") return v;
  return ambiente === "STAGING" ? "2" : "1";
}

/**
 * Formato consecutivo Hacienda CR (20 dígitos):
 * sucursal(3) + terminal(5) + tipo(2) + número(10)
 */
export function formatFeConsecutivo(params: {
  sucursalCodigo: string;
  terminalCodigo: string;
  tipoCodigo: string;
  numero: bigint | number;
}) {
  const suc = params.sucursalCodigo.padStart(3, "0").slice(-3);
  const ter = params.terminalCodigo.padStart(5, "0").slice(-5);
  const tipo = params.tipoCodigo.padStart(2, "0").slice(-2);
  const num = String(params.numero).padStart(10, "0").slice(-10);
  return `${suc}${ter}${tipo}${num}`;
}

/**
 * Clave numérica (50 dígitos) — estructura Hacienda v4.4.
 * país(3) + día(2) + mes(2) + año(2) + cédula(12) + consecutivo(20) + código seguridad(8) + situación(1)
 *
 * El último dígito es la situación: 1=normal, 2=contingencia, 3=sin internet.
 */
export function generateFeClaveNumerica(params: {
  fecha: Date;
  cedulaJuridica: string;
  consecutivo: string;
  situacion?: FeClaveSituacion;
  codigoSeguridad?: string;
}) {
  const { year, month, day } = feCalendarParts(params.fecha);
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yy = String(year).slice(-2);
  const cedula = params.cedulaJuridica.replace(/\D/g, "").padStart(12, "0").slice(-12);
  const consecutivo = params.consecutivo.padStart(20, "0").slice(-20);
  const seguridad = (params.codigoSeguridad ?? randomSecurityCode()).padStart(8, "0").slice(-8);
  const situacion = params.situacion ?? "1";
  return `506${dd}${mm}${yy}${cedula}${consecutivo}${situacion}${seguridad}`;
}

function randomSecurityCode() {
  return String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");
}
