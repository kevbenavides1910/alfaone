import type { CxcDocumentoStatus, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "facturaMensual" | "facturaMensualEmision" | "cxcDocumento" | "company">;

function toAmount(v: { toString(): string } | number): number {
  return typeof v === "number" ? v : parseFloat(v.toString());
}

/** Normaliza código SAP al formato usado en CxC (sin ceros a la izquierda). */
export function normalizeCompanySapCode(raw: string | null | undefined, fallback: string): string {
  const trimmed = (raw?.trim() || fallback.trim() || "0").replace(/^0+/, "");
  return trimmed || "0";
}

function resolveDocumentNumber(
  factura: {
    id: string;
    contractId: string;
    periodYear: number;
    periodMonth: number;
    documentNumber: string | null;
  },
  emisionDocumentNumber: string | null | undefined,
  emisionId?: string
): string {
  const fromEmision = emisionDocumentNumber?.trim();
  if (fromEmision) return fromEmision;

  const fromFactura = factura.documentNumber?.trim();
  if (fromFactura && !emisionId) return fromFactura;

  const suffix = emisionId ? emisionId.slice(-8) : factura.id.slice(-8);
  return `FM-${factura.periodYear}${String(factura.periodMonth).padStart(2, "0")}-${suffix}`;
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
  | { ok: false; code: "NOT_FOUND" | "NOT_CLOSED"; message: string };

/**
 * Crea o actualiza un documento FC en CxC a partir de una factura mensual cerrada.
 * Las filas CxC importadas desde SAP se vinculan por companySapCode + documentNumber.
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

  const payload = {
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

  // 1. Prioridad: registro con la clave exacta (companySapCode, documentNumber).
  //    Así evitamos conflictos de unicidad al actualizar un registro "linked" que
  //    tiene un documentNumber distinto.
  const existingByKey = await db.cxcDocumento.findUnique({
    where: {
      companySapCode_documentNumber: {
        companySapCode,
        documentNumber,
      },
    },
    select: { id: true, facturaMensualId: true },
  });

  if (existingByKey) {
    await db.cxcDocumento.update({
      where: { id: existingByKey.id },
      data: payload,
    });
    return { ok: true, cxcDocumentoId: existingByKey.id, created: false };
  }

  // 2. Registro vinculado por facturaMensualId (puede tener distinto documentNumber).
  //    Actualizamos sin tocar la clave única para evitar conflictos.
  const existingLinked = await db.cxcDocumento.findFirst({
    where: {
      facturaMensualId: factura.id,
      docType: { in: ["FC", "FM"] },
    },
    orderBy: { createdAt: "asc" as const },
    select: { id: true, documentNumber: true, companySapCode: true },
  });

  if (existingLinked) {
    // Si el documentNumber cambió, actualizar sin modificar la clave única para no
    // colisionar con otro registro; en su lugar, la clave queda como estaba.
    const sameKey =
      existingLinked.documentNumber === documentNumber &&
      existingLinked.companySapCode === companySapCode;

    const updateData = sameKey
      ? payload
      : { ...payload, documentNumber: existingLinked.documentNumber, companySapCode: existingLinked.companySapCode };

    await db.cxcDocumento.update({
      where: { id: existingLinked.id },
      data: updateData,
    });
    return { ok: true, cxcDocumentoId: existingLinked.id, created: false };
  }

  // 3. Crear nuevo registro.
  const created = await db.cxcDocumento.create({ data: payload });
  return { ok: true, cxcDocumentoId: created.id, created: true };
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
  const documentNumber = resolveDocumentNumber(factura, emision.documentNumber, emision.id);
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

  const payload = {
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

  const existingByKey = await db.cxcDocumento.findUnique({
    where: {
      companySapCode_documentNumber: { companySapCode, documentNumber },
    },
    select: { id: true },
  });

  if (existingByKey) {
    await db.cxcDocumento.update({ where: { id: existingByKey.id }, data: payload });
    return { ok: true, cxcDocumentoId: existingByKey.id, created: false };
  }

  const created = await db.cxcDocumento.create({ data: payload });
  return { ok: true, cxcDocumentoId: created.id, created: true };
}

export async function syncAllMissingCxcFromFacturas(db: Db): Promise<{
  processed: number;
  created: number;
  updated: number;
  errors: string[];
}> {
  const facturas = await db.facturaMensual.findMany({
    where: { status: { in: ["FACTURADO", "COBRADO"] } },
    select: { id: true, status: true },
    orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
  });

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const factura of facturas) {
    // Necesita sync si: no tiene CxC vinculado, O bien tiene CxC vinculado pero
    // todos están COBRADO/saldo=0 y la factura sigue en FACTURADO (no cobrada aún).
    const linked = await db.cxcDocumento.findFirst({
      where: {
        facturaMensualId: factura.id,
        isReajuste: false,
        docType: { in: ["FC", "FM"] },
      },
      select: { id: true, status: true, saldo: true },
      orderBy: { createdAt: "asc" as const },
    });

    const needsSync =
      !linked ||
      (factura.status === "FACTURADO" &&
        linked.status === "COBRADO" &&
        parseFloat(linked.saldo?.toString() ?? "0") <= 0);

    if (!needsSync) continue;

    const result = await syncCxcFromFacturaMensual(db, factura.id);
    if (!result.ok) {
      errors.push(`${factura.id}: ${result.message}`);
      continue;
    }
    if (result.created) created += 1;
    else updated += 1;
  }

  return { processed: facturas.length, created, updated, errors };
}
