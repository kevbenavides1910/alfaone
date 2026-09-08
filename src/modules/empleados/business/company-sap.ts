/**
 * Códigos de compañía del sistema de planilla RRHH → catálogo de empresas.
 * El mantenimiento de empresas puede sobreescribir vía Company.sapCode en BD.
 */
export const DEFAULT_SAP_TO_COMPANY: Record<string, string> = {
  "01": "ALFA",
  "02": "TANGO",
  "03": "MONITOREO",
  "04": "BENA",
  "05": "CONSORCIO",
  "06": "GRUPO",
  "08": "DESARROLLOS",
  "09": "ALFATRONIC",
  "10": "JOBEN",
  "11": "BENLO",
  "15": "KBA",
  "30": "ACE",
  "31": "ALFASECURE",
};

/**
 * Nombres NAF (`NAF5.ARCGMC.NOMBRE`) para códigos que aún no están en `companies`
 * o llegan solo como NO_CIA en pagos APEX/manuales.
 */
export const NAF_NO_CIA_LABELS: Record<string, string> = {
  "01": "Alfa",
  "02": "Tango",
  "03": "Monitoreo",
  "04": "Bena",
  "05": "Consorcio",
  "06": "Grupo Corp",
  "07": "Asesoría y Capacitación",
  "08": "Desarrollos Constructivos",
  "09": "Alfatronic",
  "10": "Joben",
  "11": "Benlo",
  "15": "Kevin Benavides Altamirano",
  "30": "ACE",
  "31": "Alfa Secure",
  AA: "Alfa General",
};

/** Etiqueta legible para un NO_CIA / sapCode (pagos, filtros). */
export function nafCiaDisplayName(noCia: string | null | undefined): string | null {
  if (!noCia?.trim()) return null;
  const key = noCia.trim();
  return NAF_NO_CIA_LABELS[key] ?? NAF_NO_CIA_LABELS[key.toUpperCase()] ?? null;
}

export type CompanySapLookup = {
  code: string;
  sapCode: string | null;
};

/** Normaliza código planilla a 2 dígitos (ej. "4" → "04", "30" → "30"). */
export function normalizeSapCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.trim().replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(2, "0");
}

export function buildSapToCompanyMap(companies: CompanySapLookup[]): Map<string, string> {
  const map = new Map<string, string>(Object.entries(DEFAULT_SAP_TO_COMPANY));
  for (const c of companies) {
    const sap = normalizeSapCode(c.sapCode);
    if (sap) map.set(sap, c.code);
  }
  return map;
}

export function resolveCompanyFromSapCode(
  rawSap: string | null | undefined,
  sapToCompany: Map<string, string>,
): { sapCode: string | null; companyCode: string | null } {
  const sapCode = normalizeSapCode(rawSap);
  if (!sapCode) return { sapCode: null, companyCode: null };
  return { sapCode, companyCode: sapToCompany.get(sapCode) ?? null };
}

export function companySapLabel(
  sapCode: string | null | undefined,
  companyCode: string | null | undefined,
  companyName: string | null | undefined,
): string {
  if (companyName && companyCode) {
    return `${companyName} (${companyCode})`;
  }
  if (companyCode) return companyCode;
  if (sapCode) return `Planilla ${sapCode}`;
  return "—";
}
