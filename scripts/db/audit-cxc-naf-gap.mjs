/**
 * Audita facturas FACTURADO/COBRADO sin NAF ligado y sin CXC,
 * y cuántas se pueden auto-corregir buscando FE+empresa en Oracle.
 *
 * Uso: node scripts/db/audit-cxc-naf-gap.mjs
 */
import { PrismaClient } from "@prisma/client";
import oracledb from "oracledb";

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
}

async function withNaf(connFn) {
  initOracle();
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
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

async function main() {
  const sinCxc = await prisma.facturaMensual.findMany({
    where: {
      status: { in: ["FACTURADO", "COBRADO"] },
      isReajuste: false,
      cxcDocumentos: { none: { docType: { in: ["FC", "FM"] } } },
      emisiones: { every: { nafDocumentos: { none: {} } } },
    },
    select: {
      id: true,
      clientNameCopied: true,
      companyCodeCopied: true,
      periodMonth: true,
      periodYear: true,
      documentNumber: true,
      invoiceNumber: true,
      totalCalculated: true,
      emisiones: { select: { id: true }, take: 1 },
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });

  const conFe = sinCxc.filter((f) => f.invoiceNumber?.trim());
  const sinFe = sinCxc.filter((f) => !f.invoiceNumber?.trim());

  const companies = await prisma.company.findMany({
    where: { isActive: true, sapCode: { not: null } },
    select: { code: true, sapCode: true },
  });
  const sapByCode = new Map(
    companies.map((c) => [c.code, (c.sapCode ?? "").replace(/^0+/, "") || c.sapCode]),
  );

  const matchable = [];
  const noMatch = [];
  const ambiguous = [];

  await withNaf(async (conn) => {
    for (const f of conFe) {
      const fe = f.invoiceNumber.trim();
      const noCia = sapByCode.get(f.companyCodeCopied);
      if (!noCia) {
        noMatch.push({ ...f, reason: "sin sapCode empresa" });
        continue;
      }
      const r = await conn.execute(
        `SELECT TO_CHAR(f.NO_FACTU) NO_FACTU, f.NO_FISICO, f.NBR_CLIENTE, f.TOTAL, f.FECHA, f.TIPO_DOC
         FROM NAF5.ARFAFE f
         WHERE f.F_ELECTRONICA = :fe AND f.NO_CIA = :noCia AND f.TIPO_DOC IN ('FC','ND','NC','AN')
         ORDER BY ABS(f.TOTAL) DESC`,
        { fe, noCia },
      );
      const rows = r.rows ?? [];
      if (rows.length === 0) {
        noMatch.push({ ...f, reason: "sin documento NAF para FE+empresa" });
      } else if (rows.length === 1) {
        matchable.push({ factura: f, naf: rows[0] });
      } else {
        ambiguous.push({ factura: f, nafRows: rows });
      }
    }
  });

  const allCxc = await prisma.cxcDocumento.findMany({
    where: { docType: { in: ["FC", "FM"] }, invoiceNumber: { not: null } },
    select: { invoiceNumber: true, companyCode: true },
  });
  const feMap = new Map();
  for (const c of allCxc) {
    const fe = c.invoiceNumber.trim();
    if (!feMap.has(fe)) feMap.set(fe, new Set());
    if (c.companyCode) feMap.get(fe).add(c.companyCode);
  }
  const feDupes = [...feMap.entries()].filter(([, cos]) => cos.size > 1);

  const conFeSinNafConCxc = await prisma.facturaMensual.count({
    where: {
      status: { in: ["FACTURADO", "COBRADO"] },
      isReajuste: false,
      invoiceNumber: { not: null },
      emisiones: { every: { nafDocumentos: { none: {} } } },
      cxcDocumentos: { some: { docType: { in: ["FC", "FM"] } } },
    },
  });

  const conFeSinNafTotal = await prisma.facturaMensual.count({
    where: {
      status: { in: ["FACTURADO", "COBRADO"] },
      isReajuste: false,
      invoiceNumber: { not: null },
      emisiones: { every: { nafDocumentos: { none: {} } } },
    },
  });

  let nafFeMultiCia = null;
  await withNaf(async (conn) => {
    const r = await conn.execute(
      `SELECT COUNT(*) CNT FROM (
         SELECT F_ELECTRONICA FROM NAF5.ARFAFE
         WHERE F_ELECTRONICA IS NOT NULL AND LENGTH(TRIM(F_ELECTRONICA)) = 20
         GROUP BY F_ELECTRONICA HAVING COUNT(DISTINCT NO_CIA) > 1
       )`,
    );
    nafFeMultiCia = r.rows?.[0]?.CNT ?? r.rows?.[0]?.[0];
  });

  console.log("=== RESUMEN AUDITORÍA ===");
  console.log(
    JSON.stringify(
      {
        facturadoSinCxc_y_sinNaf: sinCxc.length,
        deEsos_conNumeroFE: conFe.length,
        deEsos_sinNumeroFE: sinFe.length,
        autoLigables_en_Oracle: matchable.length,
        sinMatch_en_Oracle: noMatch.length,
        ambiguos_en_Oracle: ambiguous.length,
        conFESinNaf_total: conFeSinNafTotal,
        conFESinNaf_pero_ya_tienen_CXC: conFeSinNafConCxc,
        consecutivosFE_en_varias_empresas_CXC: feDupes.length,
        consecutivosFE_en_varias_NO_CIA_NAF: nafFeMultiCia,
      },
      null,
      2,
    ),
  );

  console.log(`\n=== Auto-ligables (${matchable.length}) ===`);
  for (const m of matchable) {
    const f = m.factura;
    const n = m.naf;
    console.log(
      `  ${f.periodMonth}/${f.periodYear} [${f.companyCodeCopied}] ${f.clientNameCopied.slice(0, 42)} | FE ${f.invoiceNumber} → NO_FACTU ${n.NO_FACTU} (${n.TIPO_DOC}) ₡${n.TOTAL}`,
    );
  }

  console.log(`\n=== Sin match Oracle (${noMatch.length}) ===`);
  for (const f of noMatch) {
    console.log(
      `  ${f.periodMonth}/${f.periodYear} [${f.companyCodeCopied}] ${f.clientNameCopied.slice(0, 42)} | FE ${f.invoiceNumber ?? "—"} | ${f.reason}`,
    );
  }

  if (ambiguous.length) {
    console.log(`\n=== Ambiguos (${ambiguous.length}) — revisión manual ===`);
    for (const a of ambiguous) {
      const f = a.factura;
      console.log(
        `  ${f.periodMonth}/${f.periodYear} [${f.companyCodeCopied}] ${f.clientNameCopied.slice(0, 42)} | FE ${f.invoiceNumber} | ${a.nafRows.length} docs NAF`,
      );
      for (const n of a.nafRows) {
        console.log(`      → ${n.TIPO_DOC} ${n.NO_FACTU} ₡${n.TOTAL} ${n.NBR_CLIENTE}`);
      }
    }
  }

  if (sinFe.length) {
    console.log(`\n=== Sin Nº FE (${sinFe.length}) — requieren ligar NAF manual o cerrar con doc ===`);
    for (const f of sinFe.slice(0, 10)) {
      console.log(
        `  ${f.periodMonth}/${f.periodYear} [${f.companyCodeCopied}] ${f.clientNameCopied.slice(0, 42)} | doc ${f.documentNumber ?? "—"}`,
      );
    }
    if (sinFe.length > 10) console.log(`  ... y ${sinFe.length - 10} más`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
