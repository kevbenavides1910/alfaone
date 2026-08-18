import type { PrismaClient } from "@prisma/client";
import { syncContractAdministrations } from "@/modules/presupuestos/services/sync-contract-administrations";
import { getEffectiveMonthlyBilling } from "@/modules/presupuestos/business/effectiveBilling";
import {
  FACTURA_CLOSED_STATUSES,
  getDemandBillingForPeriod,
} from "@/modules/presupuestos/business/demandBilling";
import { resolveAdministrationBillingPeriod } from "@/modules/presupuestos/business/administration-billing-period";
import { resolveEmisionSubtotals } from "@/modules/presupuestos/business/administration-billing-amount";
import { resolveContractMonthlyBilling } from "@/modules/presupuestos/business/contractPeriodBilling";
import { normalizeRequirementKey } from "@/modules/presupuestos/business/contractBillingRequirementsDefaults";
import { computeServicePeriodForInvoice } from "@/lib/utils/format";
import {
  calculateInvoiceTotal,
  computeAdministrationIvaTotals,
  extractBillingLineCatalog,
  resolveFacturaTotalsFromBilling,
} from "@/modules/presupuestos/business/billing-line-iva";
import { administrationBillingLinesSelect } from "@/modules/presupuestos/services/facturacion-includes";

type Db = Pick<
  PrismaClient,
  | "contract"
  | "contractAdministration"
  | "contractBillingLine"
  | "facturaMensual"
  | "facturaRequisito"
  | "billingHistory"
  | "contractDemandBilling"
  | "facturaMensualEmision"
>;

export type { Db };

export { calculateInvoiceTotal };

function toNum(v: { toString(): string } | number): number {
  return typeof v === "number" ? v : parseFloat(v.toString());
}

/** Último día válido del mes para un día de facturación (ej. 31 → 28 en febrero). */
export function expectedIssueDateForPeriod(
  periodYear: number,
  periodMonth: number,
  billingDay: number
): Date {
  const lastDay = new Date(Date.UTC(periodYear, periodMonth, 0)).getUTCDate();
  const day = Math.min(Math.max(1, billingDay), lastDay);
  return new Date(Date.UTC(periodYear, periodMonth - 1, day));
}

/** Vencimiento por defecto: un mes calendario después de la fecha de emisión. */
export function defaultDueDateFromIssue(issueDate: Date): Date {
  return new Date(
    Date.UTC(
      issueDate.getUTCFullYear(),
      issueDate.getUTCMonth() + 1,
      issueDate.getUTCDate()
    )
  );
}

export function calendarDayUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** true si el cierre fue en o antes de la fecha esperada de emisión (comparación por día calendario UTC). */
export function facturaClosedOnTime(closedAt: Date, expectedIssueDate: Date): boolean {
  return calendarDayUtc(closedAt) <= calendarDayUtc(expectedIssueDate);
}

/** Días de retraso respecto a la emisión esperada (0 si fue en tiempo). */
export function facturaCloseDaysLate(closedAt: Date, expectedIssueDate: Date): number {
  const diffMs = calendarDayUtc(closedAt) - calendarDayUtc(expectedIssueDate);
  return Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
}

/** Última vez que cambió la facturación mensual del contrato (historial o alta inicial). */
export function getLastContractPriceUpdateDate(
  contract: { createdAt: Date },
  billingHistory: { updatedAt: Date }[]
): Date {
  if (billingHistory.length === 0) return contract.createdAt;
  let best = -Infinity;
  let latest = contract.createdAt;
  for (const row of billingHistory) {
    const t = new Date(row.updatedAt).getTime();
    if (t > best) {
      best = t;
      latest = row.updatedAt;
    }
  }
  return latest;
}

export function parseCalendarDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function contractActiveInPeriod(
  startDate: Date,
  endDate: Date,
  periodYear: number,
  periodMonth: number
): boolean {
  const periodStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1));
  const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 0, 23, 59, 59, 999));
  return startDate <= periodEnd && endDate >= periodStart;
}

function isClosedStatus(status: string): boolean {
  return (FACTURA_CLOSED_STATUSES as readonly string[]).includes(status);
}

/** Sincroniza emisiones por administración en facturas abiertas del contrato. */
export async function syncOpenFacturaEmisionesForContract(
  db: Pick<
    PrismaClient,
    "contract" | "facturaMensual" | "facturaMensualEmision" | "facturaRequisito"
  >,
  contractId: string
): Promise<void> {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: {
      administrations: {
        orderBy: { sortOrder: "asc" },
        include: { zone: { select: { name: true } } },
      },
      billingRequirements: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!contract) return;

  const openFacturas = await db.facturaMensual.findMany({
    where: {
      contractId,
      status: { notIn: ["FACTURADO", "COBRADO"] },
    },
    include: { emisiones: { orderBy: { sortOrder: "asc" } } },
  });

  for (const factura of openFacturas) {
    const adminIds = new Set(contract.administrations.map((a) => a.id));

    const legacyOrphans = factura.emisiones.filter((e) => !e.contractAdministrationId);
    if (legacyOrphans.length > 0 && contract.administrations.length > 0) {
      await db.facturaMensualEmision.deleteMany({
        where: { id: { in: legacyOrphans.map((e) => e.id) } },
      });
      factura.emisiones = factura.emisiones.filter((e) => e.contractAdministrationId);
    }

    const orphanIds = factura.emisiones
      .filter(
        (e) => e.contractAdministrationId && !adminIds.has(e.contractAdministrationId)
      )
      .map((e) => e.id);
    if (orphanIds.length > 0) {
      await db.facturaMensualEmision.deleteMany({ where: { id: { in: orphanIds } } });
    }

    for (let i = 0; i < contract.administrations.length; i++) {
      const admin = contract.administrations[i];
      const period = resolveAdministrationBillingPeriod(admin, contract);
      const existing = factura.emisiones.find(
        (e) => e.contractAdministrationId === admin.id
      );
      const emisionData = {
        sortOrder: i,
        contractAdministrationId: admin.id,
        administrationNameCopied: admin.name,
        managerNameCopied: admin.managerName,
        zoneNameCopied: admin.zone?.name ?? null,
        billingPeriodFromDayCopied: period.fromDay,
        billingPeriodToDayCopied: period.toDay,
      };

      const emisionId = existing
        ? (
            await db.facturaMensualEmision.update({
              where: { id: existing.id },
              data: emisionData,
            })
          ).id
        : (
            await db.facturaMensualEmision.create({
              data: { facturaMensualId: factura.id, ...emisionData },
            })
          ).id;

      const existingReqs = await db.facturaRequisito.findMany({
        where: { facturaMensualId: factura.id, facturaMensualEmisionId: emisionId },
        select: { requirementName: true },
      });
      const existingKeys = new Set(
        existingReqs.map((r) => normalizeRequirementKey(r.requirementName))
      );
      const toCreate = contract.billingRequirements.filter(
        (req) => !existingKeys.has(normalizeRequirementKey(req.description))
      );
      if (toCreate.length > 0) {
        await db.facturaRequisito.createMany({
          data: toCreate.map((req, index) => ({
            facturaMensualId: factura.id,
            facturaMensualEmisionId: emisionId,
            requirementName: req.description,
            sortOrder: req.sortOrder ?? index,
            status: "PENDIENTE" as const,
            requiresEvidenceCopied: req.requiresEvidence,
          })),
        });
      }
    }

    await cleanupLegacyFacturaRequisitos(db, factura.id);
    await dedupeDuplicateFacturaRequisitos(db, factura.id);
  }
}

function requisitoKeepScore(r: {
  filePath: string | null;
  status: string;
}): number {
  return (r.filePath?.trim() ? 4 : 0) + (r.status === "COMPLETADO" ? 2 : 0);
}

/** Elimina filas duplicadas (misma emisión + mismo requisito). Conserva la más completa. */
async function dedupeDuplicateFacturaRequisitos(
  db: Pick<PrismaClient, "facturaRequisito">,
  facturaId: string
): Promise<number> {
  const requisitos = await db.facturaRequisito.findMany({
    where: { facturaMensualId: facturaId },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof requisitos>();
  for (const r of requisitos) {
    const key = `${r.facturaMensualEmisionId ?? "NULL"}::${normalizeRequirementKey(r.requirementName)}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const toDelete: string[] = [];
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => {
      const scoreDiff = requisitoKeepScore(b) - requisitoKeepScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    toDelete.push(...sorted.slice(1).map((r) => r.id));
  }

  if (toDelete.length === 0) return 0;
  await db.facturaRequisito.deleteMany({ where: { id: { in: toDelete } } });
  return toDelete.length;
}

/** Elimina requisitos huérfanos a nivel factura cuando ya hay emisiones por administración. */
async function cleanupLegacyFacturaRequisitos(
  db: Pick<PrismaClient, "facturaMensualEmision" | "facturaRequisito">,
  facturaId: string
): Promise<void> {
  const emisionCount = await db.facturaMensualEmision.count({
    where: { facturaMensualId: facturaId },
  });
  if (emisionCount === 0) return;

  await db.facturaRequisito.deleteMany({
    where: { facturaMensualId: facturaId, facturaMensualEmisionId: null },
  });
}

type BillingRequirementRow = { description: string; sortOrder: number; requiresEvidence: boolean };

/** Añade requisitos solo en facturas sin emisiones (contrato con una administración legacy). */
async function syncRequisitosForOpenFactura(
  db: Db,
  facturaId: string,
  billingRequirements: BillingRequirementRow[]
): Promise<void> {
  if (billingRequirements.length === 0) return;

  const emisionCount = await db.facturaMensualEmision.count({
    where: { facturaMensualId: facturaId },
  });
  if (emisionCount > 0) return;

  const existing = await db.facturaRequisito.findMany({
    where: { facturaMensualId: facturaId },
    select: { requirementName: true },
  });
  const existingKeys = new Set(existing.map((r) => normalizeRequirementKey(r.requirementName)));

  const toCreate = billingRequirements.filter(
    (req) => !existingKeys.has(normalizeRequirementKey(req.description))
  );
  if (toCreate.length === 0) return;

  await db.facturaRequisito.createMany({
    data: toCreate.map((req, index) => ({
      facturaMensualId: facturaId,
      requirementName: req.description,
      sortOrder: req.sortOrder ?? index,
      status: "PENDIENTE" as const,
      requiresEvidenceCopied: req.requiresEvidence,
    })),
  });
}

/** Sincroniza requisitos en facturas abiertas del contrato (por emisión si hay administraciones). */
export async function syncOpenFacturaRequisitosForContract(
  db: Db,
  contractId: string
): Promise<void> {
  await syncOpenFacturaEmisionesForContract(db, contractId);

  const contract = await db.contract.findUnique({
    where: { id: contractId },
    select: {
      billingRequirements: { orderBy: { sortOrder: "asc" } },
    },
  });
  const reqs = contract?.billingRequirements ?? [];
  if (reqs.length === 0) return;

  const openFacturas = await db.facturaMensual.findMany({
    where: {
      contractId,
      status: { notIn: ["FACTURADO", "COBRADO"] },
    },
    select: { id: true },
  });

  for (const factura of openFacturas) {
    await syncRequisitosForOpenFactura(db, factura.id, reqs);
    await dedupeDuplicateFacturaRequisitos(db, factura.id);
  }
}

/** Repara requisitos duplicados/huérfanos en facturas abiertas de un contrato. */
export async function repairOpenFacturaRequisitosForContract(
  db: Db,
  contractId: string
): Promise<{ removedLegacy: number; removedDuplicates: number }> {
  const openFacturas = await db.facturaMensual.findMany({
    where: {
      contractId,
      status: { notIn: ["FACTURADO", "COBRADO"] },
    },
    select: { id: true },
  });

  let removedLegacy = 0;
  let removedDuplicates = 0;

  await syncOpenFacturaRequisitosForContract(db, contractId);

  for (const factura of openFacturas) {
    const legacyBefore = await db.facturaRequisito.count({
      where: { facturaMensualId: factura.id, facturaMensualEmisionId: null },
    });
    await cleanupLegacyFacturaRequisitos(db, factura.id);
    const legacyAfter = await db.facturaRequisito.count({
      where: { facturaMensualId: factura.id, facturaMensualEmisionId: null },
    });
    removedLegacy += legacyBefore - legacyAfter;
    removedDuplicates += await dedupeDuplicateFacturaRequisitos(db, factura.id);
  }

  return { removedLegacy, removedDuplicates };
}

function resolveSubtotalForContract(
  contract: {
    hiringType: string;
    monthlyBilling: { toString(): string };
    billingHistory: { periodMonth: Date; monthlyBilling: { toString(): string } }[];
    demandBilling: { periodYear: number; periodMonth: number; monthlyBilling: { toString(): string } }[];
  },
  periodYear: number,
  periodMonth: number,
  asOf: Date
): number | null {
  if (contract.hiringType === "ON_DEMAND") {
    return getDemandBillingForPeriod(contract.demandBilling, periodYear, periodMonth);
  }
  return getEffectiveMonthlyBilling(
    toNum(contract.monthlyBilling),
    contract.billingHistory as Parameters<typeof getEffectiveMonthlyBilling>[1],
    asOf
  );
}

type SyncFacturaPayload = {
  subtotal: number | null;
  ivaPct: number;
  billingDay: number;
  expectedIssueDate: Date;
  lastPriceUpdateCopied: Date;
  hiringTypeCopied: string;
};

function buildSyncPayload(
  contract: {
    ivaPct: { toString(): string };
    billingDay: number;
    hiringType: string;
    client: string;
    company: string;
    createdAt: Date;
    billingHistory: { updatedAt: Date }[];
  },
  periodYear: number,
  periodMonth: number,
  subtotal: number | null
): SyncFacturaPayload {
  const ivaPct = toNum(contract.ivaPct);
  const billingDay = contract.billingDay;
  const expectedIssueDate = expectedIssueDateForPeriod(periodYear, periodMonth, billingDay);
  const lastPriceUpdateCopied = getLastContractPriceUpdateDate(contract, contract.billingHistory);

  return {
    subtotal,
    ivaPct,
    billingDay,
    expectedIssueDate,
    lastPriceUpdateCopied,
    hiringTypeCopied: contract.hiringType,
  };
}

/** Sincroniza facturas del mes: fijas con monto automático; por demanda pendientes hasta definir monto. */
export async function syncFacturasForPeriod(
  db: Db,
  periodYear: number,
  periodMonth: number,
  createdById?: string
): Promise<void> {
  const asOf = new Date(Date.UTC(periodYear, periodMonth - 1, 15));

  const contracts = await db.contract.findMany({
    where: {
      deletedAt: null,
      status: { in: ["ACTIVE", "PROLONGATION"] },
    },
    include: {
      billingRequirements: { orderBy: { sortOrder: "asc" } },
      billingLines: {
        select: { id: true, monthlyAmount: true, appliesIva: true },
      },
      administrations: {
        orderBy: { sortOrder: "asc" },
        select: { billingLines: { select: administrationBillingLinesSelect } },
      },
      billingHistory: {
        select: { periodMonth: true, monthlyBilling: true, updatedAt: true },
      },
      demandBilling: {
        where: { periodYear, periodMonth },
        select: { periodYear: true, periodMonth: true, monthlyBilling: true, updatedAt: true },
      },
    },
  });

  for (const contract of contracts) {
    if (!contractActiveInPeriod(contract.startDate, contract.endDate, periodYear, periodMonth)) {
      continue;
    }

    const subtotal = resolveSubtotalForContract(contract, periodYear, periodMonth, asOf);
    const payload = buildSyncPayload(contract, periodYear, periodMonth, subtotal);
    const amountDefined = subtotal !== null && subtotal > 0;
    const totals = amountDefined
      ? resolveFacturaTotalsFromBilling(
          subtotal!,
          payload.ivaPct,
          contract.billingLines,
          contract.administrations
        )
      : { subtotal: 0, ivaAmount: 0, total: 0 };
    const total = totals.total;

    const existing = await db.facturaMensual.findUnique({
      where: {
        contractId_periodYear_periodMonth: {
          contractId: contract.id,
          periodYear,
          periodMonth,
        },
      },
    });

    if (existing) {
      if (isClosedStatus(existing.status)) continue;

      const nextStatus = amountDefined
        ? existing.status === "PENDIENTE_DEFINIR"
          ? "PENDIENTE"
          : existing.status
        : "PENDIENTE_DEFINIR";

      await db.facturaMensual.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          subtotalCopied: amountDefined ? totals.subtotal : 0,
          ivaPctCopied: payload.ivaPct,
          totalCalculated: total,
          expectedIssueDate: payload.expectedIssueDate,
          lastPriceUpdateCopied: payload.lastPriceUpdateCopied,
          clientNameCopied: contract.client,
          companyCodeCopied: contract.company,
          billingDayCopied: payload.billingDay,
          hiringTypeCopied: payload.hiringTypeCopied as never,
        },
      });

      await syncContractAdministrations(
        db,
        contract.id,
        contract.administrationsCount ?? 1,
        createdById
      );
      await syncOpenFacturaEmisionesForContract(db, contract.id);
      await syncRequisitosForOpenFactura(db, existing.id, contract.billingRequirements);
      continue;
    }

    await db.facturaMensual.create({
      data: {
        contractId: contract.id,
        periodMonth,
        periodYear,
        expectedIssueDate: payload.expectedIssueDate,
        dueDate: defaultDueDateFromIssue(payload.expectedIssueDate),
        lastPriceUpdateCopied: payload.lastPriceUpdateCopied,
        status: amountDefined ? "PENDIENTE" : "PENDIENTE_DEFINIR",
        subtotalCopied: amountDefined ? totals.subtotal : 0,
        ivaPctCopied: payload.ivaPct,
        totalCalculated: total,
        clientNameCopied: contract.client,
        companyCodeCopied: contract.company,
        billingDayCopied: payload.billingDay,
        hiringTypeCopied: payload.hiringTypeCopied as never,
        createdById,
      },
    });

    await syncContractAdministrations(
      db,
      contract.id,
      contract.administrationsCount ?? 1,
      createdById
    );
    await syncOpenFacturaEmisionesForContract(db, contract.id);
  }
}

/** @deprecated Use syncFacturasForPeriod — conservado por compatibilidad interna. */
export async function generateMonthlyInvoices(
  db: Db,
  periodYear: number,
  periodMonth: number,
  createdById?: string
) {
  await syncFacturasForPeriod(db, periodYear, periodMonth, createdById);
  return { created: 0, skipped: 0, contractIds: [] };
}

export type CloseFacturaResult =
  | { ok: true; facturaId: string; emisionId?: string }
  | { ok: false; code: "NOT_FOUND" | "ALREADY_CLOSED" | "REQUISITOS_INCOMPLETOS" | "MONTO_PENDIENTE"; message: string; pending?: string[] };

export async function closeFacturaMensual(
  db: Db,
  facturaId: string,
  options?: { finalNotes?: string | null; isReajuste?: boolean; emisionId?: string }
): Promise<CloseFacturaResult> {
  const factura = await db.facturaMensual.findUnique({
    where: { id: facturaId },
    include: {
      requisitos: true,
      emisiones: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!factura) {
    return { ok: false, code: "NOT_FOUND", message: "Factura mensual no encontrada" };
  }

  if (factura.status === "PENDIENTE_DEFINIR") {
    return {
      ok: false,
      code: "MONTO_PENDIENTE",
      message: "Defina el monto a facturar en el contrato (pestaña Facturación por demanda) antes de cerrar",
    };
  }

  if (factura.status === "COBRADO") {
    return { ok: false, code: "ALREADY_CLOSED", message: "La factura ya fue cobrada" };
  }

  const hasEmisiones = factura.emisiones.length > 0;

  if (hasEmisiones) {
    const emisionId = options?.emisionId?.trim();
    if (!emisionId) {
      return {
        ok: false,
        code: "REQUISITOS_INCOMPLETOS",
        message: "Indique la administración a cerrar",
      };
    }

    const emision = factura.emisiones.find((e) => e.id === emisionId);
    if (!emision) {
      return { ok: false, code: "NOT_FOUND", message: "Administración no encontrada en esta factura" };
    }

    if (emision.closedAt) {
      return {
        ok: false,
        code: "ALREADY_CLOSED",
        message: "Esta administración ya fue cerrada",
      };
    }

    const emisionRequisitos = factura.requisitos.filter((r) => r.facturaMensualEmisionId === emisionId);
    const pending = emisionRequisitos.filter((r) =>
      r.requiresEvidenceCopied ? !r.filePath?.trim() : r.status !== "COMPLETADO"
    );
    if (pending.length > 0) {
      return {
        ok: false,
        code: "REQUISITOS_INCOMPLETOS",
        message: "Complete los requisitos de esta administración antes de cerrar",
        pending: pending.map((r) => r.requirementName),
      };
    }

    const closedAt = new Date();
    await db.facturaMensualEmision.update({
      where: { id: emisionId },
      data: { closedAt },
    });

    const refreshedEmisiones = await db.facturaMensualEmision.findMany({
      where: { facturaMensualId: facturaId },
      select: { closedAt: true },
    });
    const allClosed = refreshedEmisiones.every((e) => e.closedAt != null);

    await db.facturaMensual.update({
      where: { id: facturaId },
      data: {
        status: allClosed ? "FACTURADO" : "EN_PROCESO",
        closedAt: allClosed ? closedAt : null,
        isReajuste: options?.isReajuste ?? factura.isReajuste,
        ...(allClosed && options?.finalNotes !== undefined
          ? { finalNotes: options.finalNotes }
          : {}),
      },
    });

    return { ok: true, facturaId, emisionId };
  }

  if (factura.status === "FACTURADO") {
    return { ok: false, code: "ALREADY_CLOSED", message: "La factura ya fue cerrada" };
  }

  const pending = factura.requisitos.filter((r) =>
    r.requiresEvidenceCopied ? !r.filePath?.trim() : r.status !== "COMPLETADO"
  );
  if (pending.length > 0) {
    return {
      ok: false,
      code: "REQUISITOS_INCOMPLETOS",
      message: "Todos los requisitos deben estar completos antes de cerrar",
      pending: pending.map((r) => r.requirementName),
    };
  }

  await db.facturaMensual.update({
    where: { id: facturaId },
    data: {
      status: "FACTURADO",
      closedAt: new Date(),
      isReajuste: options?.isReajuste ?? false,
      ...(options?.finalNotes !== undefined ? { finalNotes: options.finalNotes } : {}),
    },
  });

  return { ok: true, facturaId };
}

export type ReturnFacturaResult =
  | { ok: true; facturaId: string }
  | {
      ok: false;
      code: "NOT_FOUND" | "NOT_FACTURADO" | "ALREADY_COBRADO";
      message: string;
    };

export async function returnFacturaMensual(
  db: Db,
  facturaId: string,
  reason: string,
  returnedById: string,
  correctionType: "DOCUMENTATION" | "AMOUNT"
): Promise<ReturnFacturaResult> {
  const factura = await db.facturaMensual.findUnique({
    where: { id: facturaId },
    select: {
      status: true,
      observationLog: true,
      subtotalCopied: true,
    },
  });

  if (!factura) {
    return { ok: false, code: "NOT_FOUND", message: "Factura mensual no encontrada" };
  }
  if (factura.status === "COBRADO") {
    return {
      ok: false,
      code: "ALREADY_COBRADO",
      message: "No se puede regresar una factura ya cobrada",
    };
  }
  if (factura.status !== "FACTURADO") {
    return {
      ok: false,
      code: "NOT_FACTURADO",
      message: "Solo se puede regresar una factura en estado Facturado",
    };
  }

  const now = new Date();
  const logLine = `[${now.toLocaleDateString("es-CR")}] Regresada para corrección (${correctionType}): ${reason}`;

  await db.facturaMensual.update({
    where: { id: facturaId },
    data: {
      status: "EN_PROCESO",
      closedAt: null,
      correctionReturnCount: { increment: 1 },
      lastCorrectionReason: reason,
      lastCorrectionReturnedAt: now,
      lastCorrectionReturnedById: returnedById,
      lastCorrectionType: correctionType,
      activeCorrectionType: correctionType,
      ...(correctionType === "AMOUNT"
        ? { lastCorrectionPreviousSubtotal: factura.subtotalCopied }
        : {}),
      observationLog: factura.observationLog ? `${factura.observationLog}\n${logLine}` : logLine,
    },
  });

  return { ok: true, facturaId };
}

export async function applyApprovedAmountChange(
  db: Db,
  facturaId: string,
  requestedSubtotal: number,
  _reviewerId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const factura = await db.facturaMensual.findUnique({
    where: { id: facturaId },
    select: { ivaPctCopied: true },
  });
  if (!factura) {
    return { ok: false, message: "Factura mensual no encontrada" };
  }

  const ivaPct = toNum(factura.ivaPctCopied);
  const total = calculateInvoiceTotal(requestedSubtotal, ivaPct);

  await db.facturaMensual.update({
    where: { id: facturaId },
    data: {
      subtotalCopied: requestedSubtotal,
      totalCalculated: total,
      status: "FACTURADO",
      closedAt: new Date(),
    },
  });

  return { ok: true };
}

export function resolveServicePeriodDates(row: {
  periodYear: number;
  periodMonth: number;
  billingPeriodFromDayCopied?: number | null;
  billingPeriodToDayCopied?: number | null;
  servicePeriodFromDate?: Date | null;
  servicePeriodToDate?: Date | null;
}): { from: Date; to: Date } {
  if (row.servicePeriodFromDate && row.servicePeriodToDate) {
    return { from: row.servicePeriodFromDate, to: row.servicePeriodToDate };
  }
  const computed = computeServicePeriodForInvoice(
    row.periodYear,
    row.periodMonth,
    row.billingPeriodFromDayCopied ?? 1,
    row.billingPeriodToDayCopied ?? 31
  );
  return {
    from: row.servicePeriodFromDate ?? computed.from,
    to: row.servicePeriodToDate ?? computed.to,
  };
}

export function serializeFacturaMensual(
  row: {
    id: string;
    contractId: string;
    periodMonth: number;
    periodYear: number;
    expectedIssueDate: Date;
    dueDate?: Date | null;
    lastPriceUpdateCopied?: Date | null;
    status: string;
    closedAt?: Date | null;
    invoiceNumber?: string | null;
    documentNumber?: string | null;
    billingPeriodFromDayCopied?: number | null;
    billingPeriodToDayCopied?: number | null;
    servicePeriodFromDate?: Date | null;
    servicePeriodToDate?: Date | null;
    invoiceReceivedAt?: Date | null;
    isReajuste?: boolean;
    finalNotes: string | null;
    observationLog: string | null;
    subtotalCopied: { toString(): string };
    ivaPctCopied: { toString(): string };
    totalCalculated: { toString(): string };
    clientNameCopied: string;
    companyCodeCopied: string;
    billingDayCopied: number;
    hiringTypeCopied?: string | null;
    createdAt: Date;
    updatedAt: Date;
    requisitos?: {
      id: string;
      facturaMensualEmisionId?: string | null;
      requirementName: string;
      status: string;
      requiresEvidenceCopied: boolean;
      filePath: string | null;
      fileName: string | null;
      mimeType: string | null;
      sortOrder: number;
      uploadedAt: Date | null;
      emision?: {
        administrationNameCopied: string | null;
        sortOrder: number;
      } | null;
    }[];
    emisiones?: {
      id: string;
      contractAdministrationId?: string | null;
      administrationNameCopied: string | null;
      managerNameCopied: string | null;
      zoneNameCopied: string | null;
      sortOrder: number;
      closedAt?: Date | null;
      invoiceNumber?: string | null;
      documentNumber?: string | null;
      invoiceReceivedAt?: Date | null;
      dueDate?: Date | null;
      subtotalFacturadoNaf?: { toString(): string } | number | null;
      totalFacturadoNaf?: { toString(): string } | number | null;
      subtotalCopied?: number | null;
      totalCalculated?: number | null;
      nafDocumentos?: {
        id: string;
        nafNoCia: string;
        nafTipoDoc: string;
        nafNoFactu: string;
        nafNoFisico: string | null;
        nafSerieFisico: string | null;
        nafConsecutivoFe: string | null;
        nafClaveFactura: string | null;
        nafFecha: Date | null;
        subtotal: { toString(): string } | number;
        impuesto: { toString(): string } | number;
        total: { toString(): string } | number;
        amountSign: number;
        signedTotal: { toString(): string } | number;
        linkedAt: Date;
      }[];
    }[];
    correctionReturnCount?: number;
    returnRequestStatus?: string | null;
    returnRequestType?: string | null;
    returnRequestRequestedSubtotal?: { toString(): string } | number | null;
    lastCorrectionType?: string | null;
    lastCorrectionPreviousSubtotal?: { toString(): string } | number | null;
    lastCorrectionReason?: string | null;
    contract?: {
      licitacionNo?: string;
      client?: string;
      company?: string;
      hiringType?: string;
      monthlyBilling?: { toString(): string };
      billingHistory?: { periodMonth: Date; monthlyBilling: { toString(): string } }[];
      demandBilling?: { periodYear: number; periodMonth: number; monthlyBilling: { toString(): string } }[];
      administrations?: {
        id: string;
        billingLines: {
          billingLineId: string;
          monthlyAmount: { toString(): string } | null;
          billingLine?: {
            monthlyAmount: { toString(): string } | null;
            appliesIva?: boolean;
          } | null;
        }[];
      }[];
      billingLines?: {
        id: string;
        monthlyAmount: { toString(): string } | null;
        appliesIva: boolean;
      }[];
    };
  }
) {
  const amountDefined = row.status !== "PENDIENTE_DEFINIR";
  const isClosed = row.status === "FACTURADO" || row.status === "COBRADO";
  const closedAtRaw = row.closedAt ?? (isClosed ? row.updatedAt : null);
  const closedOnTime =
    closedAtRaw != null ? facturaClosedOnTime(closedAtRaw, row.expectedIssueDate) : null;
  const closeDaysLate =
    closedAtRaw != null ? facturaCloseDaysLate(closedAtRaw, row.expectedIssueDate) : null;

  const contractSubtotal = amountDefined ? toNum(row.subtotalCopied) : null;
  const ivaPct = toNum(row.ivaPctCopied);
  const administrations = row.contract?.administrations ?? [];
  const emisiones = row.emisiones ?? [];
  const emisionSubtotalsByAdmin = new Map<string, number>();
  if (amountDefined && contractSubtotal != null && administrations.length > 0) {
    const subs = resolveEmisionSubtotals(contractSubtotal, administrations, administrations.length);
    administrations.forEach((a, i) => {
      if (subs[i] != null) emisionSubtotalsByAdmin.set(a.id, subs[i]!);
    });
  }

  const servicePeriod = resolveServicePeriodDates(row);

  const contractVenta =
    row.contract != null
      ? resolveContractMonthlyBilling(
          {
            hiringType: row.contract.hiringType ?? row.hiringTypeCopied ?? "FIXED",
            monthlyBilling: row.contract.monthlyBilling ?? row.subtotalCopied,
          },
          row.contract.billingHistory ?? [],
          row.contract.demandBilling ?? [],
          row.periodYear,
          row.periodMonth
        )
      : { billing: null, amountDefined: false };
  const contractVentaSubtotal =
    contractVenta.amountDefined && contractVenta.billing != null ? contractVenta.billing : null;
  const billingCatalog =
    row.contract?.billingLines && row.contract.billingLines.length > 0
      ? row.contract.billingLines
      : extractBillingLineCatalog(administrations);

  function emisionTotalsForAdmin(
    adminId: string | null | undefined,
    baseSubtotal: number | null
  ): { subtotal: number | null; total: number | null } {
    if (baseSubtotal == null) return { subtotal: null, total: null };
    if (adminId) {
      const admin = administrations.find((a) => a.id === adminId);
      if (admin) {
        const mixed = computeAdministrationIvaTotals(admin, billingCatalog, ivaPct);
        if (mixed) {
          return { subtotal: mixed.subtotal, total: mixed.total };
        }
      }
    }
    return { subtotal: baseSubtotal, total: calculateInvoiceTotal(baseSubtotal, ivaPct) };
  }

  const contractVentaTotal =
    contractVentaSubtotal != null
      ? resolveFacturaTotalsFromBilling(
          contractVentaSubtotal,
          ivaPct,
          billingCatalog,
          administrations
        ).total
      : null;
  const nafParentSubtotal = (() => {
    const withNaf = emisiones.filter(
      (e) => e.nafDocumentos && e.nafDocumentos.length > 0 && e.subtotalFacturadoNaf != null
    );
    if (withNaf.length === 0) return null;
    // If any emisión has NAF links, official facturado is parent subtotal (already recomputed)
    // or sum of NAF nets for linked + contract for unlinked — parent is source of truth after recompute.
    return amountDefined ? toNum(row.subtotalCopied) : null;
  })();
  const facturadoSubtotal =
    nafParentSubtotal != null
      ? nafParentSubtotal
      : amountDefined
        ? toNum(row.subtotalCopied)
        : null;
  const ventaFacturadoDelta =
    facturadoSubtotal != null && contractVentaSubtotal != null
      ? Math.round((facturadoSubtotal - contractVentaSubtotal) * 100) / 100
      : null;

  return {
    id: row.id,
    contractId: row.contractId,
    periodMonth: row.periodMonth,
    periodYear: row.periodYear,
    expectedIssueDate: row.expectedIssueDate.toISOString(),
    dueDate: (row.dueDate ?? defaultDueDateFromIssue(row.expectedIssueDate)).toISOString(),
    lastPriceUpdateCopied: (row.lastPriceUpdateCopied ?? row.createdAt).toISOString(),
    status: row.status,
    closedAt: closedAtRaw?.toISOString() ?? null,
    closedOnTime,
    closeDaysLate,
    amountDefined,
    hiringTypeCopied: row.hiringTypeCopied ?? row.contract?.hiringType ?? "FIXED",
    invoiceNumber: row.invoiceNumber ?? null,
    documentNumber: row.documentNumber ?? null,
    billingPeriodFromDayCopied: row.billingPeriodFromDayCopied ?? 1,
    billingPeriodToDayCopied: row.billingPeriodToDayCopied ?? 31,
    servicePeriodFromDate: servicePeriod.from.toISOString(),
    servicePeriodToDate: servicePeriod.to.toISOString(),
    invoiceReceivedAt: row.invoiceReceivedAt?.toISOString() ?? null,
    isReajuste: row.isReajuste ?? false,
    finalNotes: row.finalNotes,
    observationLog: row.observationLog,
    subtotalCopied: amountDefined ? toNum(row.subtotalCopied) : null,
    ivaPctCopied: toNum(row.ivaPctCopied),
    totalCalculated: amountDefined ? toNum(row.totalCalculated) : null,
    contractVentaSubtotal,
    contractVentaTotal,
    ventaFacturadoDelta,
    totalFacturadoNaf: (() => {
      const vals = emisiones
        .map((e) => (e.totalFacturadoNaf != null ? toNum(e.totalFacturadoNaf) : null))
        .filter((v): v is number => v != null);
      if (vals.length === 0) return null;
      return Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100;
    })(),
    subtotalFacturadoNaf: (() => {
      const vals = emisiones
        .map((e) => (e.subtotalFacturadoNaf != null ? toNum(e.subtotalFacturadoNaf) : null))
        .filter((v): v is number => v != null);
      if (vals.length === 0) return null;
      return Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100;
    })(),
    clientNameCopied: row.clientNameCopied,
    companyCodeCopied: row.companyCodeCopied,
    billingDayCopied: row.billingDayCopied,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    licitacionNo: row.contract?.licitacionNo,
    requisitos: (row.requisitos ?? []).map((r) => ({
      id: r.id,
      facturaMensualEmisionId: r.facturaMensualEmisionId ?? null,
      administrationName: r.emision?.administrationNameCopied ?? null,
      requirementName: r.requirementName,
      status: r.status,
      requiresEvidence: r.requiresEvidenceCopied,
      fileName: r.fileName,
      hasFile: Boolean(r.filePath),
      isComplete: r.requiresEvidenceCopied
        ? Boolean(r.filePath)
        : r.status === "COMPLETADO",
      sortOrder: r.sortOrder,
      uploadedAt: r.uploadedAt?.toISOString() ?? null,
      downloadUrl: r.filePath ? `/api/facturacion/${row.id}/requisitos/${r.id}/archivo` : null,
    })),
    emisiones: emisiones.map((e, idx) => {
      const nafLinks = (e.nafDocumentos ?? []).map((n) => ({
        id: n.id,
        nafNoCia: n.nafNoCia,
        nafTipoDoc: n.nafTipoDoc,
        nafNoFactu: n.nafNoFactu,
        nafNoFisico: n.nafNoFisico,
        nafSerieFisico: n.nafSerieFisico,
        nafConsecutivoFe: n.nafConsecutivoFe,
        nafClaveFactura: n.nafClaveFactura,
        nafFecha: n.nafFecha?.toISOString() ?? null,
        subtotal: toNum(n.subtotal),
        impuesto: toNum(n.impuesto),
        total: toNum(n.total),
        amountSign: n.amountSign,
        signedTotal: toNum(n.signedTotal),
        linkedAt: n.linkedAt.toISOString(),
      }));
      const hasNaf = nafLinks.length > 0;
      const nafSubtotal = e.subtotalFacturadoNaf != null ? toNum(e.subtotalFacturadoNaf) : null;
      const nafTotal = e.totalFacturadoNaf != null ? toNum(e.totalFacturadoNaf) : null;
      const contractEmSubtotal =
        (e.contractAdministrationId
          ? emisionSubtotalsByAdmin.get(e.contractAdministrationId)
          : undefined) ??
        (emisionSubtotalsByAdmin.size > 0
          ? [...emisionSubtotalsByAdmin.values()][idx]
          : undefined) ??
        null;
      const emSubtotal = hasNaf && nafSubtotal != null ? nafSubtotal : contractEmSubtotal;
      const emMixed = emisionTotalsForAdmin(e.contractAdministrationId, contractEmSubtotal);
      const emTotal =
        hasNaf && nafTotal != null
          ? nafTotal
          : emMixed.total;
      const ventaDelta =
        emSubtotal != null && contractEmSubtotal != null
          ? Math.round((emSubtotal - contractEmSubtotal) * 100) / 100
          : null;
      return {
        id: e.id,
        administrationName: e.administrationNameCopied,
        managerName: e.managerNameCopied,
        zoneName: e.zoneNameCopied,
        sortOrder: e.sortOrder,
        closedAt: e.closedAt?.toISOString() ?? null,
        invoiceNumber: e.invoiceNumber ?? null,
        documentNumber: e.documentNumber ?? null,
        invoiceReceivedAt: e.invoiceReceivedAt?.toISOString() ?? null,
        dueDate: e.dueDate?.toISOString() ?? null,
        status:
          row.status === "COBRADO"
            ? "COBRADO"
            : e.closedAt
              ? "FACTURADO"
              : row.status,
        subtotalCopied: emSubtotal,
        totalCalculated: emTotal,
        subtotalFacturadoNaf: nafSubtotal,
        totalFacturadoNaf: nafTotal,
        contractVentaSubtotal: contractEmSubtotal,
        contractVentaTotal: emMixed.total,
        ventaFacturadoDelta: ventaDelta,
        nafLinks,
      };
    }),
    returnRequestStatus: (row.returnRequestStatus as "PENDING" | "APPROVED" | "REJECTED" | null) ?? null,
    returnRequestType: (row.returnRequestType as "DOCUMENTATION" | "AMOUNT" | null) ?? null,
    returnRequestRequestedSubtotal:
      row.returnRequestRequestedSubtotal != null
        ? toNum(row.returnRequestRequestedSubtotal)
        : null,
    lastCorrectionType: (row.lastCorrectionType as "DOCUMENTATION" | "AMOUNT" | null) ?? null,
    lastCorrectionPreviousSubtotal:
      row.lastCorrectionPreviousSubtotal != null
        ? toNum(row.lastCorrectionPreviousSubtotal)
        : null,
    lastCorrectionReason: row.lastCorrectionReason ?? null,
    isModifiedAfterBilling: (row.correctionReturnCount ?? 0) > 0,
  };
}
