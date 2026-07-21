/**
 * Rematchea cxc_documentos con documentNumber sintético FM-YYYYMM-* hacia el
 * NO_FISICO de NAF ligado a la factura/emisión.
 *
 * Uso (dry-run por defecto):
 *   node scripts/db/repair-cxc-fm-document-numbers.mjs
 * Aplicar cambios:
 *   node scripts/db/repair-cxc-fm-document-numbers.mjs --apply
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function isSyntheticFm(value) {
  return typeof value === "string" && /^FM-\d{6}-/i.test(value.trim());
}

function pickNoFisico(links) {
  const ranked = [...links].sort((a, b) => Number(b.total) - Number(a.total));
  const fcs = ranked.filter((l) => (l.nafTipoDoc || "").toUpperCase() === "FC");
  const pool = fcs.length > 0 ? fcs : ranked;
  const withPhysical = pool.find((l) => l.nafNoFisico?.trim());
  return withPhysical?.nafNoFisico?.trim() || null;
}

function normalizeCompanySapCode(raw, fallback) {
  const trimmed = (raw?.trim() || fallback.trim() || "0").replace(/^0+/, "");
  return trimmed || "0";
}

async function main() {
  const rows = await prisma.cxcDocumento.findMany({
    where: { documentNumber: { startsWith: "FM-" } },
    select: {
      id: true,
      documentNumber: true,
      companySapCode: true,
      companyCode: true,
      facturaMensualId: true,
      clientName: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const synthetic = rows.filter((r) => isSyntheticFm(r.documentNumber));
  console.log(`CxC con FM-: ${synthetic.length}${APPLY ? " (APPLY)" : " (dry-run)"}`);

  let updated = 0;
  let merged = 0;
  let skipped = 0;
  const unresolved = [];

  for (const row of synthetic) {
    if (!row.facturaMensualId) {
      unresolved.push({ id: row.id, documentNumber: row.documentNumber, reason: "sin facturaMensualId" });
      skipped += 1;
      continue;
    }

    const factura = await prisma.facturaMensual.findUnique({
      where: { id: row.facturaMensualId },
      select: {
        id: true,
        documentNumber: true,
        companyCodeCopied: true,
        emisiones: {
          select: {
            documentNumber: true,
            nafDocumentos: {
              select: {
                nafTipoDoc: true,
                nafNoFisico: true,
                total: true,
              },
            },
          },
        },
      },
    });

    if (!factura) {
      unresolved.push({ id: row.id, documentNumber: row.documentNumber, reason: "factura no encontrada" });
      skipped += 1;
      continue;
    }

    const allLinks = factura.emisiones.flatMap((e) => e.nafDocumentos);
    let noFisico = pickNoFisico(allLinks);
    if (!noFisico) {
      const fromEmision = factura.emisiones.map((e) => e.documentNumber?.trim()).find(Boolean);
      const fromFactura = factura.documentNumber?.trim();
      const candidate = fromEmision || fromFactura || null;
      if (candidate && !isSyntheticFm(candidate)) noFisico = candidate;
    }

    if (!noFisico) {
      unresolved.push({
        id: row.id,
        documentNumber: row.documentNumber,
        clientName: row.clientName,
        reason: "sin NO_FISICO en NAF",
      });
      skipped += 1;
      continue;
    }

    const company = await prisma.company.findUnique({
      where: { code: factura.companyCodeCopied },
      select: { sapCode: true },
    });
    const companySapCode = normalizeCompanySapCode(company?.sapCode, row.companyCode || factura.companyCodeCopied);

    const collision = await prisma.cxcDocumento.findUnique({
      where: {
        companySapCode_documentNumber: { companySapCode, documentNumber: noFisico },
      },
      select: { id: true },
    });

    console.log(
      `  ${row.documentNumber} → ${noFisico} (${row.clientName ?? "—"})` +
        (collision && collision.id !== row.id ? " [merge]" : "")
    );

    if (!APPLY) {
      updated += 1;
      continue;
    }

    if (collision && collision.id !== row.id) {
      await prisma.cxcDocumento.update({
        where: { id: collision.id },
        data: {
          facturaMensualId: row.facturaMensualId,
          companySapCode,
          documentNumber: noFisico,
        },
      });
      await prisma.cxcDocumento.delete({ where: { id: row.id } });
      merged += 1;
    } else {
      await prisma.cxcDocumento.update({
        where: { id: row.id },
        data: { companySapCode, documentNumber: noFisico },
      });
      updated += 1;
    }

    // Alinear factura/emisión si aún tienen FM o null
    await prisma.facturaMensual.update({
      where: { id: factura.id },
      data: { documentNumber: noFisico },
    });
    for (const em of factura.emisiones) {
      if (!em.documentNumber || isSyntheticFm(em.documentNumber)) {
        await prisma.facturaMensualEmision.updateMany({
          where: {
            facturaMensualId: factura.id,
            OR: [{ documentNumber: null }, { documentNumber: { startsWith: "FM-" } }],
          },
          data: { documentNumber: noFisico },
        });
        break;
      }
    }
  }

  console.log(`\nActualizados: ${updated}`);
  console.log(`Fusionados: ${merged}`);
  console.log(`Sin resolver: ${skipped}`);
  if (unresolved.length) {
    console.log("Detalle sin resolver:");
    for (const u of unresolved) {
      console.log(`  - ${u.id} ${u.documentNumber}: ${u.reason}`);
    }
  }
  if (!APPLY) {
    console.log("\nDry-run: no se escribió nada. Reejecutar con --apply para aplicar.");
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
