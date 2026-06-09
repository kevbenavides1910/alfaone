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
  "08": "DESARROLLOS",
  "09": "ALFATRONIC",
  "10": "JOBEN",
  "11": "BENLO",
  "30": "ACE",
};

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
