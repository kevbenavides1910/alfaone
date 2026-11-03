import { normalizeIdentificacion } from "./fe-identificacion";

/**
 * Usuario ATV / Tribu TicoFactura.
 * - Staging/prod Tribu: cpf-…@stag.comprobanteselectronicos.go.cr (usar tal cual)
 * - Portal ATV: cédula. La jurídica puede incluir letras.
 */
export function normalizeAtvUsuarioInput(raw?: string | null): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (v.includes("@")) return v;
  return normalizeIdentificacion(v, "JURIDICA") || null;
}

export function resolveAtvUsernameForToken(empresa: {
  atvUsuario?: string | null;
  atvUsuarioStg?: string | null;
  cedulaJuridica: string;
  ambiente?: string | null;
}): string {
  const isStaging = empresa.ambiente === "STAGING";
  const raw = isStaging ? (empresa.atvUsuarioStg?.trim() || empresa.atvUsuario?.trim()) : empresa.atvUsuario?.trim();
  if (raw) {
    if (raw.includes("@")) return raw;
    return normalizeIdentificacion(raw, "JURIDICA");
  }
  return normalizeIdentificacion(empresa.cedulaJuridica, "JURIDICA");
}

export function resolveAtvPasswordEncForToken(empresa: {
  atvPasswordEnc?: string | null;
  atvPasswordEncStg?: string | null;
  ambiente?: string | null;
}): string | null {
  const isStaging = empresa.ambiente === "STAGING";
  return isStaging
    ? (empresa.atvPasswordEncStg ?? empresa.atvPasswordEnc ?? null)
    : (empresa.atvPasswordEnc ?? null);
}

export function isTribuAtvUsuario(usuario?: string | null): boolean {
  return Boolean(usuario?.includes("@"));
}
