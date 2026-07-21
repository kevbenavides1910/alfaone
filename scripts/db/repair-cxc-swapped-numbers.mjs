/**
 * Repara filas CxC/factura donde documentNumber tiene el consecutivo FE (20 dígitos)
 * y invoiceNumber tiene el NO_FISICO corto — o documentNumber es FM- y invoiceNumber
 * parece NO_FISICO.
 *
 * Uso: node scripts/db/repair-cxc-swapped-numbers.cjs [--apply]
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function isFeConsecutivo(v) {
  return typeof v === "string" && /^\d{20}$/.test(v.trim());
}

function isSyntheticFm(v) {
  return typeof v === "string" && /^FM-\d{6}-/i.test(v.trim());
}

function isLikelyNoFisico(v) {
  if (!v || typeof v !== "string") return false;
  const t = v.trim();
  if (!t || isSyntheticFm(t) || isFeConsecutivo(t)) return false;
  // típico NAF: numérico corto o alfanumérico corto
  return t.length <= 12;
}

function normalizeCompanySapCode(raw, fallback) {
  const trimmed = (raw?.trim() || fallback.trim() || "0").replace(/^0+/, "");
  return trimmed || "0";
}

async function main() {
  const rows = await prisma.cxcDocumento.findMany({
    where: { docType: { in: ["FC", "FM"] } },
    select: {
      id: true,
      documentNumber: true,
      invoiceNumber: true,
      clientName: true,
      companySapCode: true,
      companyCode: true,
      facturaMensualId: true,
    },
  });

  const swaps = [];
  const fmFromInvoice = [];

  for (const r of rows) {
    if (isFeConsecutivo(r.documentNumber) && isLikelyNoFisico(r.invoiceNumber)) {
      swaps.push(r);
    } else if (isSyntheticFm(r.documentNumber) && isLikelyNoFisico(r.invoiceNumber)) {
      fmFromInvoice.push(r);
    }
  }

  console.log(`Swaps FE↔NO_FISICO: ${swaps.length}${APPLY ? " (APPLY)" : " (dry-run)"}`);
  for (const r of swaps) {
    console.log(
      `  ${r.clientName}: doc ${r.documentNumber} ↔ inv ${r.invoiceNumber}`
    );
  }
  console.log(`\nFM- → invoiceNumber como doc: ${fmFromInvoice.length}`);
  for (const r of fmFromInvoice) {
    console.log(`  ${r.clientName}: ${r.documentNumber} → ${r.invoiceNumber}`);
  }

  let updated = 0;
  let merged = 0;
  let errors = [];

  async function migrateKey(row, newDoc, newInv) {
    const company = row.companyCode
      ? await prisma.company.findUnique({
          where: { code: row.companyCode },
          select: { sapCode: true },
        })
      : null;
    const companySapCode = normalizeCompanySapCode(
      company?.sapCode ?? row.companySapCode,
      row.companyCode || row.companySapCode
    );

    const collision = await prisma.cxcDocumento.findUnique({
      where: {
        companySapCode_documentNumber: {
          companySapCode,
          documentNumber: newDoc,
        },
      },
      select: { id: true },
    });

    if (!APPLY) {
      updated += 1;
      return;
    }

    if (collision && collision.id !== row.id) {
      await prisma.cxcDocumento.update({
        where: { id: collision.id },
        data: {
          facturaMensualId: row.facturaMensualId,
          invoiceNumber: newInv,
          companySapCode,
          documentNumber: newDoc,
        },
      });
      await prisma.cxcDocumento.delete({ where: { id: row.id } });
      merged += 1;
    } else {
      await prisma.cxcDocumento.update({
        where: { id: row.id },
        data: {
          companySapCode,
          documentNumber: newDoc,
          invoiceNumber: newInv,
        },
      });
      updated += 1;
    }

    if (row.facturaMensualId) {
      await prisma.facturaMensual.update({
        where: { id: row.facturaMensualId },
        data: { documentNumber: newDoc, invoiceNumber: newInv },
      });
      await prisma.facturaMensualEmision.updateMany({
        where: { facturaMensualId: row.facturaMensualId },
        data: { documentNumber: newDoc, invoiceNumber: newInv },
      });
    }
  }

  for (const r of swaps) {
    try {
      await migrateKey(r, r.invoiceNumber.trim(), r.documentNumber.trim());
    } catch (e) {
      errors.push(`${r.id}: ${e.message}`);
    }
  }

  for (const r of fmFromInvoice) {
    try {
      // document = former invoice; invoice unknown (null) unless we keep nothing
      await migrateKey(r, r.invoiceNumber.trim(), null);
    } catch (e) {
      errors.push(`${r.id}: ${e.message}`);
    }
  }

  // Sync facturas with real documentNumber but no CxC
  const needCxc = await prisma.facturaMensual.findMany({
    where: {
      status: { in: ["FACTURADO", "COBRADO"] },
      documentNumber: { not: null },
      NOT: { documentNumber: { startsWith: "FM-" } },
      cxcDocumentos: { none: { docType: { in: ["FC", "FM"] } } },
    },
    select: {
      id: true,
      clientNameCopied: true,
      documentNumber: true,
      invoiceNumber: true,
      periodMonth: true,
      periodYear: true,
      companyCodeCopied: true,
      contractId: true,
      closedAt: true,
      updatedAt: true,
      totalCalculated: true,
      status: true,
      dueDate: true,
      cxcExpectedPaymentDate: true,
      provisionalReceiptNumber: true,
      provisionalPaymentAmount: true,
      cxcObservations: true,
      paidAt: true,
      isReajuste: true,
      invoiceReceivedAt: true,
      servicePeriodFromDate: true,
      clientNameCopied: true,
    },
  });

  console.log(`\nFacturas con Nº real sin CxC: ${needCxc.length}`);
  for (const f of needCxc) {
    console.log(
      `  ${f.periodMonth}/${f.periodYear} ${f.clientNameCopied} doc=${f.documentNumber}`
    );
    if (!APPLY) continue;

    const company = await prisma.company.findUnique({
      where: { code: f.companyCodeCopied },
      select: { sapCode: true },
    });
    const companySapCode = normalizeCompanySapCode(company?.sapCode, f.companyCodeCopied);
    const total = parseFloat(f.totalCalculated.toString());
    const cobrado = f.status === "COBRADO";
    const payload = {
      contractId: f.contractId,
      facturaMensualId: f.id,
      companySapCode,
      companyCode: f.companyCodeCopied,
      documentNumber: f.documentNumber.trim(),
      invoiceNumber: f.invoiceNumber?.trim() || null,
      docType: "FC",
      documentDate: f.closedAt ?? f.updatedAt,
      invoiceReceivedAt: f.invoiceReceivedAt,
      servicePeriodDate:
        f.servicePeriodFromDate ??
        new Date(Date.UTC(f.periodYear, f.periodMonth - 1, 1)),
      montoOriginal: total,
      saldo: cobrado ? 0 : total,
      clientName: f.clientNameCopied,
      dueDate: f.dueDate,
      cxcExpectedPaymentDate: f.cxcExpectedPaymentDate ?? f.dueDate,
      provisionalReceiptNumber: f.provisionalReceiptNumber,
      provisionalPaymentAmount: f.provisionalPaymentAmount,
      cxcObservations: f.cxcObservations,
      status: cobrado ? "COBRADO" : "PENDIENTE",
      paidAt: cobrado ? f.paidAt : null,
      isReajuste: f.isReajuste ?? false,
    };

    const existing = await prisma.cxcDocumento.findUnique({
      where: {
        companySapCode_documentNumber: {
          companySapCode,
          documentNumber: payload.documentNumber,
        },
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.cxcDocumento.update({ where: { id: existing.id }, data: payload });
      console.log(`    → linked existing CxC ${existing.id}`);
    } else {
      const created = await prisma.cxcDocumento.create({ data: payload });
      console.log(`    → created CxC ${created.id}`);
    }
  }

  console.log(`\nActualizados: ${updated}`);
  console.log(`Fusionados: ${merged}`);
  if (errors.length) {
    console.log("Errores:");
    for (const e of errors) console.log(`  - ${e}`);
  }
  if (!APPLY) console.log("\nDry-run. Reejecutar con --apply para aplicar.");

  const leftFm = await prisma.cxcDocumento.count({
    where: { documentNumber: { startsWith: "FM-" } },
  });
  console.log(`\nCxC con FM- restantes: ${leftFm}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
