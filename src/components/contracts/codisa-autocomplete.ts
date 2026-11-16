/**
 * Cliente UI: lookup Codisa (activos) + extensión One vía /api/contracts/codisa-ext.
 */

export type CodisaExtFormPayload = {
  licitacionNo: string;
  company: string | null;
  client: string | null;
  clientType: "PUBLIC" | "PRIVATE" | null;
  hiringType: "FIXED" | "ON_DEMAND" | null;
  status: string | null;
  officersCount: number | null;
  positionsCount: number | null;
  administrationsCount: number | null;
  monthlyBilling: number | null;
  ivaPct: number | null;
  billingDay: number | null;
  billingPeriodFromDay: number | null;
  billingPeriodToDay: number | null;
  laborPct: number | null;
  suppliesPct: number | null;
  adminPct: number | null;
  profitPct: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
};

export type CodisaAutocompletePart = {
  noCia: string;
  noContrato: string;
  companyCode: string | null;
  form: CodisaExtFormPayload;
  extension: {
    contractId: string | null;
    officersCount: number | null;
    positionsCount: number | null;
    administrationsCount: number | null;
    ivaPct: number | null;
    matchMethod: string | null;
  } | null;
};

export type CodisaContractSuggestion = {
  noCia: string;
  noContrato: string;
  companyCode: string | null;
  cliente: string | null;
  via: "codisa" | "alias";
  oneLicitacionNo: string | null;
};

export type CodisaLookupBundle = {
  query: string;
  resolvedVia: "codisa_exact" | "codisa_licitacion" | "alias" | "codisa_partial" | "none";
  oneLicitacionNo: string | null;
  parts: CodisaAutocompletePart[];
  suggestions?: CodisaContractSuggestion[];
};

const VALID_STATUS = new Set([
  "ACTIVE",
  "PROLONGATION",
  "SUSPENDED",
  "FINISHED",
  "CANCELLED",
]);

export async function fetchCodisaContractBundle(
  noContrato: string,
  noCia?: string | null,
): Promise<CodisaLookupBundle | null> {
  const key = noContrato.trim();
  if (key.length < 3) return null;

  const params = new URLSearchParams({ noContrato: key, bundle: "1" });
  if (noCia?.trim()) params.set("noCia", noCia.trim());

  const res = await fetch(`/api/contracts/codisa-ext?${params.toString()}`, {
    credentials: "same-origin",
  });
  if (res.status === 404) {
    return { query: key, resolvedVia: "none", oneLicitacionNo: null, parts: [], suggestions: [] };
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Error Codisa (${res.status})`);
  }
  const json = await res.json();
  const data = (json.data ?? json) as CodisaLookupBundle;
  return {
    ...data,
    parts: data.parts ?? [],
    suggestions: data.suggestions ?? [],
  };
}

/** Campos del formulario que se rellenan desde Codisa + extensión. */
export function formFieldsFromCodisaPart(
  part: CodisaAutocompletePart,
  opts?: { keepLicitacionNo?: string },
): Record<string, unknown> {
  const f = part.form;
  const status =
    f.status && VALID_STATUS.has(f.status) ? f.status : "ACTIVE";

  const out: Record<string, unknown> = {
    licitacionNo: opts?.keepLicitacionNo?.trim() || f.licitacionNo,
  };

  if (f.company) out.company = f.company;
  if (f.client) out.client = f.client;
  if (f.clientType) out.clientType = f.clientType;
  if (f.hiringType) out.hiringType = f.hiringType;
  out.status = status;

  if (f.officersCount != null) out.officersCount = f.officersCount;
  if (f.positionsCount != null) out.positionsCount = f.positionsCount;
  if (f.monthlyBilling != null) out.monthlyBilling = f.monthlyBilling;
  if (f.ivaPct != null) out.ivaPct = f.ivaPct;
  if (f.billingDay != null) out.billingDay = f.billingDay;
  if (f.billingPeriodFromDay != null) out.billingPeriodFromDay = f.billingPeriodFromDay;
  if (f.billingPeriodToDay != null) out.billingPeriodToDay = f.billingPeriodToDay;
  if (f.laborPct != null) out.laborPct = f.laborPct;
  if (f.suppliesPct != null) out.suppliesPct = f.suppliesPct;
  if (f.adminPct != null) out.adminPct = f.adminPct;
  if (f.profitPct != null) out.profitPct = f.profitPct;
  if (f.startDate) out.startDate = f.startDate;
  if (f.endDate) out.endDate = f.endDate;
  if (f.notes) out.notes = f.notes;

  return out;
}
