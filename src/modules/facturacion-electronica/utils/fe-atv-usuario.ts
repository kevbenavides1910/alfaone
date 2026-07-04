/**
 * Usuario ATV / Tribu TicoFactura.
 * - Staging/prod Tribu: cpf-…@stag.comprobanteselectronicos.go.cr (usar tal cual)
 * - Portal ATV clásico: cédula solo dígitos
 */
export function normalizeAtvUsuarioInput(raw?: string | null): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (v.includes("@")) return v;
  const digits = v.replace(/\D/g, "");
  return digits || null;
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
    return raw.replace(/\D/g, "");
  }
  return empresa.cedulaJuridica.replace(/\D/g, "");
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
