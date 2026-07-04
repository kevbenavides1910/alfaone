import { mergeDisciplinaryCcList } from "@/modules/disciplinario/services/disciplinary-email";

export type FeEmpresaCorreoContacto = {
  email?: string | null;
  correoRemitente?: string | null;
  correoCopiaFija?: string | null;
};

/** Direcciones de contacto del emisor que deben recibir copia de todos los comprobantes. */
export function buildFeComprobanteContactoCcRaw(empresa: FeEmpresaCorreoContacto): string {
  return [empresa.email, empresa.correoRemitente, empresa.correoCopiaFija]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join("; ");
}

export function buildFeComprobanteCcList(
  destinatario: string,
  empresa: FeEmpresaCorreoContacto,
  destinatariosCopia?: string[]
): string[] {
  const contactoCc = buildFeComprobanteContactoCcRaw(empresa);
  const extraCc = destinatariosCopia?.map((e) => e.trim()).filter(Boolean).join(", ");
  return mergeDisciplinaryCcList(destinatario, contactoCc || undefined, extraCc || undefined);
}

/** Integración contable: si hay CC fijo explícito, exigir XML respuesta Hacienda. */
export function feRequiereXmlRespuestaParaCorreo(empresa: FeEmpresaCorreoContacto): boolean {
  return Boolean(empresa.correoCopiaFija?.trim());
}
