import type { PrismaClient } from "@prisma/client";

export type DefaultBillingRequirement = {
  description: string;
  requiresEvidence: boolean;
};

/** Requisitos estándar de facturación para todos los contratos. */
export const BASE_DEFAULT_BILLING_REQUIREMENTS: readonly DefaultBillingRequirement[] = [
  { description: "CCSS certificación", requiresEvidence: false },
  { description: "INS", requiresEvidence: false },
  { description: "RT", requiresEvidence: false },
  { description: "FID", requiresEvidence: false },
  { description: "Civil", requiresEvidence: false },
  { description: "FODESAF", requiresEvidence: false },
  { description: "Certificaciones", requiresEvidence: true },
  { description: "Planillas CCSS", requiresEvidence: true },
  { description: "Planilla INS", requiresEvidence: true },
  { description: "Trámite a través de correo", requiresEvidence: true },
] as const;

export const SICERE_BILLING_REQUIREMENT: DefaultBillingRequirement = {
  description: "SICERE",
  requiresEvidence: true,
};

export type ContractBillingContext = {
  client: string;
  notes?: string | null;
  licitacionNo?: string | null;
};

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Clave de comparación para evitar duplicados con distinta capitalización o tildes. */
export function normalizeRequirementKey(description: string): string {
  return stripDiacritics(description.trim().toLowerCase()).replace(/\s+/g, " ");
}

/**
 * Contratos de área de salud (AS), CCSS salud, CENDEISSS, etc. requieren SICERE además del listado base.
 */
export function contractNeedsSicereRequirement(contract: ContractBillingContext): boolean {
  const text = stripDiacritics(
    [contract.client, contract.notes ?? "", contract.licitacionNo ?? ""].join(" ")
  ).toLowerCase();

  if (/area\s*(de\s*)?salud/.test(text)) return true;
  if (/\bsalud\b/.test(text) && /\bccss\b/.test(text)) return true;
  if (/\bcendeisss\b/.test(text)) return true;
  if (/\bsicere\b/.test(text)) return true;
  // AS como sigla (p. ej. "CCSS AS Coronado", " - AS ")
  if (/(^|[\s\-/])as([\s\-/.,]|$)/i.test(text)) return true;

  return false;
}

export function getDefaultBillingRequirementsForContract(
  contract: ContractBillingContext
): DefaultBillingRequirement[] {
  const list: DefaultBillingRequirement[] = [...BASE_DEFAULT_BILLING_REQUIREMENTS];
  if (contractNeedsSicereRequirement(contract)) {
    list.push(SICERE_BILLING_REQUIREMENT);
  }
  return list;
}

type BillingDb = Pick<
  PrismaClient,
  "contract" | "contractBillingRequirement" | "facturaMensual" | "facturaRequisito" | "facturaMensualEmision"
>;

async function syncOpenFacturaRequisitosForContractLocal(
  db: BillingDb,
  contractId: string
): Promise<void> {
  const reqs = await db.contractBillingRequirement.findMany({
    where: { contractId },
    orderBy: { sortOrder: "asc" },
    select: { description: true, sortOrder: true, requiresEvidence: true },
  });
  if (reqs.length === 0) return;

  const openFacturas = await db.facturaMensual.findMany({
    where: {
      contractId,
      status: { notIn: ["FACTURADO", "COBRADO"] },
    },
    select: { id: true },
  });

  for (const factura of openFacturas) {
    const emisionCount = await db.facturaMensualEmision.count({
      where: { facturaMensualId: factura.id },
    });
    if (emisionCount > 0) continue;

    const existing = await db.facturaRequisito.findMany({
      where: { facturaMensualId: factura.id },
      select: { requirementName: true },
    });
    const existingNames = new Set(existing.map((r) => r.requirementName));
    const toCreate = reqs.filter((req) => !existingNames.has(req.description));
    if (toCreate.length === 0) continue;

    await db.facturaRequisito.createMany({
      data: toCreate.map((req, index) => ({
        facturaMensualId: factura.id,
        requirementName: req.description,
        sortOrder: req.sortOrder ?? index,
        status: "PENDIENTE" as const,
        requiresEvidenceCopied: req.requiresEvidence ?? true,
      })),
    });
  }
}

/**
 * Agrega los requisitos por defecto que el contrato aún no tiene (idempotente).
 */
export async function ensureDefaultBillingRequirements(
  db: BillingDb,
  contractId: string,
  contract?: ContractBillingContext,
  options?: { createdById?: string; syncOpenFacturas?: boolean }
): Promise<{ added: string[] }> {
  const ctx =
    contract ??
    (await db.contract.findFirst({
      where: { id: contractId, deletedAt: null },
      select: { client: true, notes: true, licitacionNo: true },
    }));
  if (!ctx) return { added: [] };

  const desired = getDefaultBillingRequirementsForContract(ctx);
  const existing = await db.contractBillingRequirement.findMany({
    where: { contractId },
    select: { description: true, sortOrder: true },
  });
  const existingKeys = new Set(existing.map((r) => normalizeRequirementKey(r.description)));
  const maxSort = existing.reduce((max, r) => Math.max(max, r.sortOrder), -1);
  const missing = desired.filter(
    (d) => !existingKeys.has(normalizeRequirementKey(d.description))
  );

  if (missing.length === 0) return { added: [] };

  await db.contractBillingRequirement.createMany({
    data: missing.map((req, index) => ({
      contractId,
      description: req.description,
      requiresEvidence: req.requiresEvidence,
      sortOrder: maxSort + 1 + index,
      createdById: options?.createdById ?? null,
    })),
  });

  if (options?.syncOpenFacturas !== false && "facturaMensual" in db) {
    await syncOpenFacturaRequisitosForContractLocal(db as BillingDb, contractId);
  }

  return { added: missing.map((r) => r.description) };
}
