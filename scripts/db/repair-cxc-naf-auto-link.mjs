/**
 * Liga documentos NAF y sincroniza CXC para facturas FACTURADO/COBRADO
 * sin NAF y sin CXC, cuando Oracle devuelve un único match FE+empresa.
 *
 * Uso:
 *   node scripts/db/repair-cxc-naf-auto-link.mjs          # dry-run
 *   node scripts/db/repair-cxc-naf-auto-link.mjs --apply  # aplicar
 */
import { PrismaClient } from "@prisma/client";
import oracledb from "oracledb";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

function initOracle() {
  const libDir = process.env.NAF_ORACLE_CLIENT_DIR;
  if (libDir) {
    try {
      oracledb.initOracleClient({ libDir });
    } catch {
      /* already initialized */
    }
  }
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
}

async function withNaf(connFn) {
  initOracle();
  const conn = await oracledb.getConnection({
    user: process.env.NAF_ORACLE_USER,
    password: process.env.NAF_ORACLE_PASSWORD,
    connectString: process.env.NAF_ORACLE_CONNECT_STRING,
  });
  try {
    return await connFn(conn);
  } finally {
    await conn.close();
  }
}

async function loadCandidates() {
  const rows = await prisma.facturaMensual.findMany({
    where: {
      status: { in: ["FACTURADO", "COBRADO"] },
      isReajuste: false,
      invoiceNumber: { not: null },
      cxcDocumentos: { none: { docType: { in: ["FC", "FM"] } } },
      emisiones: { every: { nafDocumentos: { none: {} } } },
    },
    select: {
      id: true,
      clientNameCopied: true,
      companyCodeCopied: true,
      periodMonth: true,
      periodYear: true,
      invoiceNumber: true,
      emisiones: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
  });
  return rows.filter((f) => f.invoiceNumber?.trim() && f.emisiones[0]?.id);
}

async function resolveNafMatch(conn, factura, sapByCode) {
  const fe = factura.invoiceNumber.trim();
  const noCia = sapByCode.get(factura.companyCodeCopied);
  if (!noCia) return { ok: false, reason: "sin sapCode empresa" };

  const r = await conn.execute(
    `SELECT TO_CHAR(f.NO_FACTU) NO_FACTU, f.TIPO_DOC, f.NBR_CLIENTE, f.TOTAL
     FROM NAF5.ARFAFE f
     WHERE f.F_ELECTRONICA = :fe AND f.NO_CIA = :noCia AND f.TIPO_DOC IN ('FC','ND','NC','AN')
     ORDER BY ABS(f.TOTAL) DESC`,
    { fe, noCia },
  );
  const rows = r.rows ?? [];
  if (rows.length === 0) return { ok: false, reason: "sin documento NAF para FE+empresa" };
  if (rows.length > 1) return { ok: false, reason: `ambiguo (${rows.length} docs NAF)` };
  return {
    ok: true,
    key: {
      noCia,
      tipoDoc: String(rows[0].TIPO_DOC).trim().toUpperCase(),
      noFactu: String(rows[0].NO_FACTU).trim(),
    },
    naf: rows[0],
  };
}

async function main() {
  const { linkNafDocumento } = await import(
    "../../src/modules/presupuestos/services/factura-emision-naf-link.ts"
  );
  const { syncCxcFromFacturaMensual } = await import(
    "../../src/modules/presupuestos/services/sync-cxc-from-factura.ts"
  );

  const companies = await prisma.company.findMany({
    where: { isActive: true, sapCode: { not: null } },
    select: { code: true, sapCode: true },
  });
  const sapByCode = new Map(
    companies.map((c) => [c.code, (c.sapCode ?? "").replace(/^0+/, "") || c.sapCode]),
  );

  const candidates = await loadCandidates();
  console.log(`Candidatas con FE: ${candidates.length}${APPLY ? " (APPLY)" : " (dry-run)"}`);

  const results = { linked: 0, synced: 0, skipped: 0, errors: [] };

  await withNaf(async (conn) => {
    for (const factura of candidates) {
      const label = `${factura.periodMonth}/${factura.periodYear} [${factura.companyCodeCopied}] ${factura.clientNameCopied.slice(0, 42)}`;
      const match = await resolveNafMatch(conn, factura, sapByCode);
      if (!match.ok) {
        results.skipped += 1;
        continue;
      }

      const emisionId = factura.emisiones[0].id;
      const { key, naf } = match;
      console.log(
        `  ${label}\n    FE ${factura.invoiceNumber} → ${key.tipoDoc} ${key.noFactu} (₡${naf.TOTAL})`,
      );

      if (!APPLY) {
        results.linked += 1;
        results.synced += 1;
        continue;
      }

      try {
        const link = await linkNafDocumento(prisma, {
          facturaId: factura.id,
          emisionId,
          key,
        });
        if (!link.ok) {
          results.errors.push(`${label}: link ${link.message}`);
          continue;
        }
        results.linked += 1;

        const sync = await syncCxcFromFacturaMensual(prisma, factura.id);
        if (!sync.ok) {
          results.errors.push(`${label}: sync ${sync.message}`);
          continue;
        }
        results.synced += 1;
        console.log(`    → CXC ${sync.created ? "creado" : "actualizado"} ${sync.cxcDocumentoId}`);
      } catch (e) {
        results.errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  });

  console.log("\n=== Resultado ===");
  console.log(`Ligados NAF: ${results.linked}`);
  console.log(`CXC sincronizados: ${results.synced}`);
  console.log(`Omitidos (sin match único): ${results.skipped}`);
  if (results.errors.length) {
    console.log("Errores:");
    for (const err of results.errors) console.log(`  - ${err}`);
  }
  if (!APPLY) {
    console.log("\nDry-run. Reejecutar con --apply para aplicar.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
