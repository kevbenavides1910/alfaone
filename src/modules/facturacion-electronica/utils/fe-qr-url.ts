import type { FeAmbiente } from "@prisma/client";

/** URL pública de consulta ATV para el código QR del comprobante. */
export function feQrConsultaUrl(ambiente: FeAmbiente, claveNumerica: string): string {
  const base =
    ambiente === "PRODUCCION"
      ? "https://atv.hacienda.go.cr/atv/ComprobanteElectronico/consulta"
      : "https://atv-sandbox.hacienda.go.cr/atv/ComprobanteElectronico/consulta";
  return `${base}?clave=${claveNumerica}`;
}
