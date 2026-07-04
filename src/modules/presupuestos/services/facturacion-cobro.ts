import type { PrismaClient } from "@prisma/client";
import { getEffectiveMonthlyBilling } from "@/modules/presupuestos/business/effectiveBilling";
import {
  FACTURA_CLOSED_STATUSES,
  getDemandBillingForPeriod,
} from "@/modules/presupuestos/business/demandBilling";

type Db = Pick<
  PrismaClient,
  "contract" | "facturaMensual" | "facturaRequisito" | "billingHistory" | "contractDemandBilling"
>;

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

export function calculateInvoiceTotal(subtotal: number, ivaPct: number): number {
  return Math.round(subtotal * (1 + ivaPct / 100) * 100) / 100;
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

function calendarDayUtc(d: Date): number {
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

type BillingRequirementRow = { description: string; sortOrder: number };

/** Añade a facturas abiertas los requisitos del contrato que aún no existen en la factura. */
async function syncRequisitosForOpenFactura(
  db: Db,
  facturaId: string,
  billingRequirements: BillingRequirementRow[]
): Promise<void> {
  if (billingRequirements.length === 0) return;

  const existing = await db.facturaRequisito.findMany({
    where: { facturaMensualId: facturaId },
    select: { requirementName: true },
  });
  const existingNames = new Set(existing.map((r) => r.requirementName));

  const toCreate = billingRequirements.filter((req) => !existingNames.has(req.description));
  if (toCreate.length === 0) return;

  await db.facturaRequisito.createMany({
    data: toCreate.map((req, index) => ({
      facturaMensualId: facturaId,
      requirementName: req.description,
      sortOrder: req.sortOrder ?? index,
      status: "PENDIENTE" as const,
    })),
  });
}

/** Sincroniza requisitos en todas las facturas abiertas de un contrato (p. ej. tras agregar requisito). */
export async function syncOpenFacturaRequisitosForContract(
  db: Db,
  contractId: string
): Promise<void> {
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
  }
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
    contract.billingHistory as { periodMonth: Date; monthlyBilling: { toString(): string } }[],
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
    const total = amountDefined ? calculateInvoiceTotal(subtotal!, payload.ivaPct) : 0;

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
          subtotalCopied: amountDefined ? subtotal! : 0,
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
        subtotalCopied: amountDefined ? subtotal! : 0,
        ivaPctCopied: payload.ivaPct,
        totalCalculated: total,
        clientNameCopied: contract.client,
        companyCodeCopied: contract.company,
        billingDayCopied: payload.billingDay,
        hiringTypeCopied: payload.hiringTypeCopied as never,
        createdById,
        requisitos: {
          create: contract.billingRequirements.map((req, index) => ({
            requirementName: req.description,
            sortOrder: req.sortOrder ?? index,
            status: "PENDIENTE",
          })),
        },
      },
    });
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
  | { ok: true; facturaId: string }
  | { ok: false; code: "NOT_FOUND" | "ALREADY_CLOSED" | "REQUISITOS_INCOMPLETOS" | "MONTO_PENDIENTE"; message: string; pending?: string[] };

export async function closeFacturaMensual(
  db: Db,
  facturaId: string,
  finalNotes?: string | null
): Promise<CloseFacturaResult> {
  const factura = await db.facturaMensual.findUnique({
    where: { id: facturaId },
    include: { requisitos: true },
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

  if (factura.status === "FACTURADO" || factura.status === "COBRADO") {
    return { ok: false, code: "ALREADY_CLOSED", message: "La factura ya fue cerrada" };
  }

  const pending = factura.requisitos.filter((r) => !r.filePath?.trim());
  if (pending.length > 0) {
    return {
      ok: false,
      code: "REQUISITOS_INCOMPLETOS",
      message: "Todos los requisitos deben tener un archivo subido antes de cerrar",
      pending: pending.map((r) => r.requirementName),
    };
  }

  await db.facturaMensual.update({
    where: { id: facturaId },
    data: {
      status: "FACTURADO",
      closedAt: new Date(),
      ...(finalNotes !== undefined ? { finalNotes } : {}),
    },
  });

  return { ok: true, facturaId };
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
      requirementName: string;
      status: string;
      filePath: string | null;
      fileName: string | null;
      mimeType: string | null;
      sortOrder: number;
      uploadedAt: Date | null;
    }[];
    contract?: { licitacionNo?: string; client?: string; company?: string; hiringType?: string };
  }
) {
  const amountDefined = row.status !== "PENDIENTE_DEFINIR";
  const isClosed = row.status === "FACTURADO" || row.status === "COBRADO";
  const closedAtRaw = row.closedAt ?? (isClosed ? row.updatedAt : null);
  const closedOnTime =
    closedAtRaw != null ? facturaClosedOnTime(closedAtRaw, row.expectedIssueDate) : null;
  const closeDaysLate =
    closedAtRaw != null ? facturaCloseDaysLate(closedAtRaw, row.expectedIssueDate) : null;

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
    finalNotes: row.finalNotes,
    observationLog: row.observationLog,
    subtotalCopied: amountDefined ? toNum(row.subtotalCopied) : null,
    ivaPctCopied: toNum(row.ivaPctCopied),
    totalCalculated: amountDefined ? toNum(row.totalCalculated) : null,
    clientNameCopied: row.clientNameCopied,
    companyCodeCopied: row.companyCodeCopied,
    billingDayCopied: row.billingDayCopied,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    licitacionNo: row.contract?.licitacionNo,
    requisitos: (row.requisitos ?? []).map((r) => ({
      id: r.id,
      requirementName: r.requirementName,
      status: r.status,
      fileName: r.fileName,
      hasFile: Boolean(r.filePath),
      sortOrder: r.sortOrder,
      uploadedAt: r.uploadedAt?.toISOString() ?? null,
      downloadUrl: r.filePath ? `/api/facturacion/${row.id}/requisitos/${r.id}/archivo` : null,
    })),
  };
}
