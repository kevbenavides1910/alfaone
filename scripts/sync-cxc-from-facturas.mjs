/**
 * Backfill CxC desde facturas mensuales — ejecutable con node en el contenedor de producción.
 * Uso: node scripts/sync-cxc-from-facturas.mjs
 *
 * Nº documento: solo NO_FACTU de Codisa (factura/emisión). Nunca inventa FM-….
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function toAmount(v) {
  return typeof v === "number" ? v : parseFloat(v.toString());
}

function normalizeCompanySapCode(raw, fallback) {
  const trimmed = (raw?.trim() || fallback.trim() || "0").replace(/^0+/, "");
  return trimmed || "0";
}

function isSyntheticFmDocumentNumber(value) {
  const v = value?.trim();
  if (!v) return false;
  return /^FM-\d{6}-/i.test(v);
}

function resolveDocumentNumber(factura, emisionDocumentNumber) {
  const fromEmision = emisionDocumentNumber?.trim();
  if (fromEmision && !isSyntheticFmDocumentNumber(fromEmision)) return fromEmision;
  const fromFactura = factura.documentNumber?.trim();
  if (fromFactura && !isSyntheticFmDocumentNumber(fromFactura)) return fromFactura;
  return null;
}

function resolveInvoiceNumber(facturaInvoice, emisionInvoice) {
  return facturaInvoice?.trim() || emisionInvoice?.trim() || null;
}

function resolveServicePeriodDate(factura) {
  if (factura.servicePeriodFromDate) return factura.servicePeriodFromDate;
  return new Date(Date.UTC(factura.periodYear, factura.periodMonth - 1, 1));
}

async function syncCxcFromFacturaMensual(facturaId) {
  const factura = await prisma.facturaMensual.findUnique({
    where: { id: facturaId },
    include: {
      emisiones: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { documentNumber: true, invoiceNumber: true, invoiceReceivedAt: true },
      },
    },
  });

  if (!factura) return { ok: false, code: "NOT_FOUND", message: "Factura no encontrada" };
  if (factura.status !== "FACTURADO" && factura.status !== "COBRADO") {
    return { ok: false, code: "NOT_CLOSED", message: "Factura no cerrada" };
  }

  const company = await prisma.company.findUnique({
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
      message: "Sin Nº documento de Codisa (NO_FACTU)",
    };
  }

  const invoiceNumber = resolveInvoiceNumber(factura.invoiceNumber, firstEmision?.invoiceNumber);
  const total = toAmount(factura.totalCalculated);
  const cobrado = factura.status === "COBRADO";
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
    status: cobrado ? "COBRADO" : "PENDIENTE",
    paidAt: cobrado ? factura.paidAt : null,
    isReajuste: false,
  };

  const existingByKey = await prisma.cxcDocumento.findUnique({
    where: { companySapCode_documentNumber: { companySapCode, documentNumber } },
    select: { id: true },
  });

  const existingLinked = await prisma.cxcDocumento.findFirst({
    where: {
      facturaMensualId: factura.id,
      isReajuste: false,
      docType: { in: ["FC", "FM"] },
    },
    select: { id: true, documentNumber: true, companySapCode: true },
  });

  if (existingByKey) {
    if (existingLinked && existingLinked.id !== existingByKey.id) {
      await prisma.cxcDocumento.update({ where: { id: existingByKey.id }, data: payload });
      if (isSyntheticFmDocumentNumber(existingLinked.documentNumber)) {
        await prisma.cxcDocumento.delete({ where: { id: existingLinked.id } });
      }
      return { ok: true, created: false };
    }
    await prisma.cxcDocumento.update({ where: { id: existingByKey.id }, data: payload });
    return { ok: true, created: false };
  }

  if (existingLinked) {
    await prisma.cxcDocumento.update({ where: { id: existingLinked.id }, data: payload });
    return { ok: true, created: false };
  }

  await prisma.cxcDocumento.create({ data: payload });
  return { ok: true, created: true };
}

async function main() {
  const facturas = await prisma.facturaMensual.findMany({
    where: { status: { in: ["FACTURADO", "COBRADO"] } },
    select: { id: true },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const factura of facturas) {
    const hasCxc = await prisma.cxcDocumento.findFirst({
      where: {
        facturaMensualId: factura.id,
        isReajuste: false,
        docType: { in: ["FC", "FM"] },
      },
      select: { id: true, documentNumber: true },
    });
    if (hasCxc && !isSyntheticFmDocumentNumber(hasCxc.documentNumber)) continue;

    const result = await syncCxcFromFacturaMensual(factura.id);
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

  console.log(`Facturas revisadas: ${facturas.length}`);
  console.log(`Documentos CxC creados: ${created}`);
  console.log(`Documentos CxC actualizados: ${updated}`);
  console.log(`Omitidos (sin NO_FISICO NAF): ${skipped}`);
  if (errors.length) {
    console.log("Errores:");
    for (const err of errors) console.log(`  - ${err}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
