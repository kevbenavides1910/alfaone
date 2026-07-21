import type { CxcDocumentoStatus, Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "facturaMensual" | "facturaMensualEmision" | "cxcDocumento" | "company">;

function toAmount(v: { toString(): string } | number): number {
  return typeof v === "number" ? v : parseFloat(v.toString());
}

/** Normaliza código SAP al formato usado en CxC (sin ceros a la izquierda). */
export function normalizeCompanySapCode(raw: string | null | undefined, fallback: string): string {
  const trimmed = (raw?.trim() || fallback.trim() || "0").replace(/^0+/, "");
  return trimmed || "0";
}

/** Números inventados por Alfa One (`FM-YYYYMM-<cuid>`); no son NO_FISICO de NAF. */
export function isSyntheticFmDocumentNumber(value: string | null | undefined): boolean {
  const v = value?.trim();
  if (!v) return false;
  return /^FM-\d{6}-/i.test(v);
}

/**
 * Nº documento = NO_FISICO de NAF (copiado en factura/emisión al ligar).
 * Nunca inventa `FM-…`.
 */
function resolveDocumentNumber(
  factura: { documentNumber: string | null },
  emisionDocumentNumber: string | null | undefined
): string | null {
  const fromEmision = emisionDocumentNumber?.trim();
  if (fromEmision && !isSyntheticFmDocumentNumber(fromEmision)) return fromEmision;

  const fromFactura = factura.documentNumber?.trim();
  if (fromFactura && !isSyntheticFmDocumentNumber(fromFactura)) return fromFactura;

  return null;
}

function resolveInvoiceNumber(
  facturaInvoice: string | null,
  emisionInvoice: string | null | undefined
): string | null {
  return facturaInvoice?.trim() || emisionInvoice?.trim() || null;
}

function resolveServicePeriodDate(factura: {
  servicePeriodFromDate: Date | null;
  periodYear: number;
  periodMonth: number;
}): Date {
  if (factura.servicePeriodFromDate) return factura.servicePeriodFromDate;
  return new Date(Date.UTC(factura.periodYear, factura.periodMonth - 1, 1));
}

export type SyncCxcFromFacturaResult =
  | { ok: true; cxcDocumentoId: string; created: boolean }
  | {
      ok: false;
      code: "NOT_FOUND" | "NOT_CLOSED" | "NO_DOCUMENT_NUMBER" | "DOCUMENT_NUMBER_COLLISION";
      message: string;
    };

type CxcPayload = {
  contractId: string;
  facturaMensualId: string;
  companySapCode: string;
  companyCode: string;
  documentNumber: string;
  invoiceNumber: string | null;
  docType: string;
  documentDate: Date;
  invoiceReceivedAt: Date | null;
  servicePeriodDate: Date;
  montoOriginal: number;
  saldo: number;
  clientName: string;
  dueDate: Date | null;
  cxcExpectedPaymentDate: Date | null;
  provisionalReceiptNumber: string | null;
  provisionalPaymentAmount: Prisma.Decimal | number | null;
  cxcObservations: string | null;
  status: CxcDocumentoStatus;
  paidAt: Date | null;
  isReajuste: boolean;
};

/**
 * Crea o actualiza CxC con la clave NAF. Si ya existía con otra clave (p. ej. FM-…),
 * migra `documentNumber` / `companySapCode` al valor real.
 */
async function upsertCxcDocumento(
  db: Db,
  payload: CxcPayload
): Promise<SyncCxcFromFacturaResult> {
  const { companySapCode, documentNumber, facturaMensualId } = payload;

  const existingByKey = await db.cxcDocumento.findUnique({
    where: {
      companySapCode_documentNumber: { companySapCode, documentNumber },
    },
    select: { id: true, facturaMensualId: true },
  });

  const existingLinked = await db.cxcDocumento.findFirst({
    where: {
      facturaMensualId,
      docType: { in: ["FC", "FM"] },
    },
    orderBy: { createdAt: "asc" as const },
    select: { id: true, documentNumber: true, companySapCode: true },
  });

  if (existingByKey) {
    if (existingLinked && existingLinked.id !== existingByKey.id) {
      // Colisión: ya hay fila SAP/CxC con el NO_FISICO y otra ligada (p. ej. FM-).
      // Fusionar en la clave real y eliminar la sintética.
      await db.cxcDocumento.update({
        where: { id: existingByKey.id },
        data: payload,
      });
      if (isSyntheticFmDocumentNumber(existingLinked.documentNumber)) {
        await db.cxcDocumento.delete({ where: { id: existingLinked.id } });
      }
      return { ok: true, cxcDocumentoId: existingByKey.id, created: false };
    }

    await db.cxcDocumento.update({
      where: { id: existingByKey.id },
      data: payload,
    });
    return { ok: true, cxcDocumentoId: existingByKey.id, created: false };
  }

  if (existingLinked) {
    const sameKey =
      existingLinked.documentNumber === documentNumber &&
      existingLinked.companySapCode === companySapCode;

    if (sameKey) {
      await db.cxcDocumento.update({
        where: { id: existingLinked.id },
        data: payload,
      });
      return { ok: true, cxcDocumentoId: existingLinked.id, created: false };
    }

    // Migrar clave (FM- → NO_FISICO u otro cambio de NAF).
    try {
      await db.cxcDocumento.update({
        where: { id: existingLinked.id },
        data: payload,
      });
      return { ok: true, cxcDocumentoId: existingLinked.id, created: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Unique constraint") || msg.includes("unique")) {
        return {
          ok: false,
          code: "DOCUMENT_NUMBER_COLLISION",
          message: `Ya existe un CxC con documento ${documentNumber} (empresa ${companySapCode})`,
        };
      }
      throw e;
    }
  }

  const created = await db.cxcDocumento.create({ data: payload });
  return { ok: true, cxcDocumentoId: created.id, created: true };
}

/**
 * Crea o actualiza un documento FC en CxC a partir de una factura mensual cerrada.
 * Requiere Nº documento real (NO_FISICO de NAF); no inventa FM-….
 */
export async function syncCxcFromFacturaMensual(
  db: Db,
  facturaId: string
): Promise<SyncCxcFromFacturaResult> {
  const factura = await db.facturaMensual.findUnique({
    where: { id: facturaId },
    include: {
      emisiones: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: {
          documentNumber: true,
          invoiceNumber: true,
          invoiceReceivedAt: true,
          totalFacturadoNaf: true,
          _count: { select: { nafDocumentos: true } },
        },
      },
    },
  });

  if (!factura) {
    return { ok: false, code: "NOT_FOUND", message: "Factura mensual no encontrada" };
  }

  if (factura.status !== "FACTURADO" && factura.status !== "COBRADO") {
    return {
      ok: false,
      code: "NOT_CLOSED",
      message: "Solo se sincronizan facturas en estado Facturado o Cobrado",
    };
  }

  const company = await db.company.findUnique({
    where: { code: factura.companyCodeCopied },
    select: { sapCode: true },
  });

  const firstEmision = factura.emisiones[0];
  const companySapCode = normalizeCompanySapCode(company?.sapCode, factura.companyCodeCopied);
  const documentNumber = resolveDocumentNumber(factura, firstEmision?.documentNumber);
  if (!documentNumber) {
    return {
      ok: false,
      code: "NO_DOCUMENT_NUMBER",
      message:
        "Sin Nº documento de NAF (NO_FISICO). Ligar el documento NAF antes de sincronizar CxC.",
    };
  }

  const invoiceNumber = resolveInvoiceNumber(factura.invoiceNumber, firstEmision?.invoiceNumber);
  const total =
    firstEmision && firstEmision._count.nafDocumentos > 0 && firstEmision.totalFacturadoNaf != null
      ? toAmount(firstEmision.totalFacturadoNaf)
      : toAmount(factura.totalCalculated);
  const cobrado = factura.status === "COBRADO";
  const cxcStatus: CxcDocumentoStatus = cobrado ? "COBRADO" : "PENDIENTE";
  const saldo = cobrado ? 0 : total;
  const documentDate = factura.closedAt ?? factura.updatedAt;
  const invoiceReceivedAt =
    factura.invoiceReceivedAt ?? firstEmision?.invoiceReceivedAt ?? null;

  const payload: CxcPayload = {
    contractId: factura.contractId,
    facturaMensualId: factura.id,
    companySapCode,
    companyCode: factura.companyCodeCopied,
    documentNumber,
    invoiceNumber,
    docType: "FC",
    documentDate,
    invoiceReceivedAt,
    servicePeriodDate: resolveServicePeriodDate(factura),
    montoOriginal: total,
    saldo,
    clientName: factura.clientNameCopied,
    dueDate: factura.dueDate,
    cxcExpectedPaymentDate: factura.cxcExpectedPaymentDate ?? factura.dueDate,
    provisionalReceiptNumber: factura.provisionalReceiptNumber,
    provisionalPaymentAmount: factura.provisionalPaymentAmount,
    cxcObservations: factura.cxcObservations,
    status: cxcStatus,
    paidAt: cobrado ? factura.paidAt : null,
    isReajuste: factura.isReajuste ?? false,
  };

  return upsertCxcDocumento(db, payload);
}

/** Sincroniza CxC para una emisión (administración) cerrada de forma independiente. */
export async function syncCxcFromFacturaEmision(
  db: Db,
  facturaId: string,
  emisionId: string,
  emisionTotal: number
): Promise<SyncCxcFromFacturaResult> {
  const factura = await db.facturaMensual.findUnique({
    where: { id: facturaId },
    include: {
      emisiones: {
        where: { id: emisionId },
        select: {
          id: true,
          closedAt: true,
          documentNumber: true,
          invoiceNumber: true,
          invoiceReceivedAt: true,
          totalFacturadoNaf: true,
          _count: { select: { nafDocumentos: true } },
        },
      },
    },
  });

  if (!factura) {
    return { ok: false, code: "NOT_FOUND", message: "Factura mensual no encontrada" };
  }

  const emision = factura.emisiones[0];
  if (!emision?.closedAt) {
    return {
      ok: false,
      code: "NOT_CLOSED",
      message: "La administración aún no está cerrada",
    };
  }

  const company = await db.company.findUnique({
    where: { code: factura.companyCodeCopied },
    select: { sapCode: true },
  });

  const companySapCode = normalizeCompanySapCode(company?.sapCode, factura.companyCodeCopied);
  const documentNumber = resolveDocumentNumber(factura, emision.documentNumber);
  if (!documentNumber) {
    return {
      ok: false,
      code: "NO_DOCUMENT_NUMBER",
      message:
        "Sin Nº documento de NAF (NO_FISICO). Ligar el documento NAF antes de sincronizar CxC.",
    };
  }

  const invoiceNumber = resolveInvoiceNumber(factura.invoiceNumber, emision.invoiceNumber);
  const nafTotal =
    emision._count.nafDocumentos > 0 && emision.totalFacturadoNaf != null
      ? toAmount(emision.totalFacturadoNaf)
      : null;
  const resolvedTotal = nafTotal != null ? nafTotal : emisionTotal;
  const cobrado = factura.status === "COBRADO";
  const cxcStatus: CxcDocumentoStatus = cobrado ? "COBRADO" : "PENDIENTE";
  const saldo = cobrado ? 0 : resolvedTotal;
  const documentDate = emision.closedAt ?? factura.updatedAt;
  const invoiceReceivedAt = emision.invoiceReceivedAt ?? factura.invoiceReceivedAt ?? null;

  const payload: CxcPayload = {
    contractId: factura.contractId,
    facturaMensualId: factura.id,
    companySapCode,
    companyCode: factura.companyCodeCopied,
    documentNumber,
    invoiceNumber,
    docType: "FC",
    documentDate,
    invoiceReceivedAt,
    servicePeriodDate: resolveServicePeriodDate(factura),
    montoOriginal: resolvedTotal,
    saldo,
    clientName: factura.clientNameCopied,
    dueDate: factura.dueDate,
    cxcExpectedPaymentDate: factura.cxcExpectedPaymentDate ?? factura.dueDate,
    provisionalReceiptNumber: factura.provisionalReceiptNumber,
    provisionalPaymentAmount: factura.provisionalPaymentAmount,
    cxcObservations: factura.cxcObservations,
    status: cxcStatus,
    paidAt: cobrado ? factura.paidAt : null,
    isReajuste: factura.isReajuste ?? false,
  };

  return upsertCxcDocumento(db, payload);
}

export async function syncAllMissingCxcFromFacturas(db: Db): Promise<{
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  const facturas = await db.facturaMensual.findMany({
    where: { status: { in: ["FACTURADO", "COBRADO"] } },
    select: { id: true, status: true },
    orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const factura of facturas) {
    const linked = await db.cxcDocumento.findFirst({
      where: {
        facturaMensualId: factura.id,
        isReajuste: false,
        docType: { in: ["FC", "FM"] },
      },
      select: { id: true, status: true, saldo: true, documentNumber: true },
      orderBy: { createdAt: "asc" as const },
    });

    const needsSync =
      !linked ||
      isSyntheticFmDocumentNumber(linked.documentNumber) ||
      (factura.status === "FACTURADO" &&
        linked.status === "COBRADO" &&
        parseFloat(linked.saldo?.toString() ?? "0") <= 0);

    if (!needsSync) continue;

    const result = await syncCxcFromFacturaMensual(db, factura.id);
    if (!result.ok) {
      if (result.code === "NO_DOCUMENT_NUMBER") {
        skipped += 1;
        continue;
      }
      errors.push(`${factura.id}: ${result.message}`);
      continue;
    }
    if (result.created) created += 1;
    else updated += 1;
  }

  return { processed: facturas.length, created, updated, skipped, errors };
}
