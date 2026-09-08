import { prisma } from "@/modules/core/db/prisma";
import { DEFAULT_SAP_TO_COMPANY } from "@/modules/empleados/business/company-sap";

export type PaymentCompanyFilter = string | string[] | undefined;

/** Normaliza query `company` / `companies` a lista (vacía = todas). */
export function parsePaymentCompanyParams(searchParams: URLSearchParams): string[] {
  const multi = searchParams.getAll("company").flatMap((v) => v.split(","));
  const alt = searchParams.get("companies")?.split(",") ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...multi, ...alt]) {
    const v = raw.trim();
    if (!v || v === "all") continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * Expande códigos de filtro a alias almacenados en Payment.company
 * (p. ej. ALFA ↔ 01 vía Company.sapCode + mapa SAP por defecto).
 */
export async function expandPaymentCompanyFilter(
  filter?: PaymentCompanyFilter,
): Promise<string[] | undefined> {
  const selected = (Array.isArray(filter) ? filter : filter ? [filter] : [])
    .map((s) => s.trim())
    .filter((s) => s && s !== "all");
  if (selected.length === 0) return undefined;

  const companies = await prisma.company.findMany({
    select: { code: true, sapCode: true },
  });
  const set = new Set<string>();

  const addAliases = (code: string, sap: string) => {
    if (code) set.add(code);
    if (sap) set.add(sap);
  };

  for (const s of selected) {
    set.add(s);
    for (const c of companies) {
      const sap = c.sapCode?.trim() || "";
      if (c.code === s || (sap && sap === s)) {
        addAliases(c.code, sap);
      }
    }
    for (const [sap, code] of Object.entries(DEFAULT_SAP_TO_COMPANY)) {
      if (s === sap || s === code) addAliases(code, sap);
    }
  }
  return [...set];
}

export function paymentCompanyWhere(
  codes: string[] | undefined,
): { company: string } | { company: { in: string[] } } | Record<string, never> {
  if (!codes?.length) return {};
  if (codes.length === 1) return { company: codes[0] };
  return { company: { in: codes } };
}
