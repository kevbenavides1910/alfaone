/**
 * Remapea documentNumber de CxC/factura de NO_FISICO (o FE suffix) → NO_FACTU Codisa.
 *
 * Uso:
 *   node scripts/db/repair-cxc-document-to-nofactu.mjs
 *   node scripts/db/repair-cxc-document-to-nofactu.mjs --apply
 */
const { PrismaClient } = require("@prisma/client");
const oracledb = require("oracledb");

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function normalizeCompanySapCode(raw, fallback) {
  const trimmed = (raw?.trim() || fallback.trim() || "0").replace(/^0+/, "");
  return trimmed || "0";
}

function isFeConsecutivo(v) {
  return typeof v === "string" && /^\d{20}$/.test(v.trim());
}

function isSyntheticFm(v) {
  return typeof v === "string" && /^FM-\d{6}-/i.test(v.trim());
}

/** Heurística: doc corto que coincide con cola del FE → era NO_FISICO, no NO_FACTU. */
function looksLikeNoFisicoNotNoFactu(documentNumber, invoiceNumber) {
  const d = documentNumber?.trim();
  if (!d || isSyntheticFm(d) || isFeConsecutivo(d)) return false;
  if (d.length > 10) return false; // NO_FACTU Codisa suele ser más largo (p.ej. 511006)
  const inv = invoiceNumber?.trim();
  if (inv && isFeConsecutivo(inv) && inv.endsWith(d)) {
    return true;
  }
  if (inv && inv === d) return true; // ambos NO_FISICO legacy
  // números cortos típicos de NO_FISICO (< 5-6 dígitos o hasta ~5k range for JOBEN)
  if (/^\d{1,5}$/.test(d)) return true;
  return false;
}

async function pickNoFactuFromLinks(facturaMensualId) {
  const links = await prisma.facturaEmisionNafDocumento.findMany({
    where: { emision: { facturaMensualId } },
    select: {
      nafTipoDoc: true,
      nafNoFactu: true,
      nafNoFisico: true,
      nafConsecutivoFe: true,
      total: true,
    },
  });
  if (!links.length) return null;
  const ranked = [...links].sort((a, b) => Number(b.total) - Number(a.total));
  const fcs = ranked.filter((l) => (l.nafTipoDoc || "").toUpperCase() === "FC");
  const pool = fcs.length > 0 ? fcs : ranked;
  const withFactu = pool.find((l) => l.nafNoFactu?.trim());
  const withFe = pool.find((l) => l.nafConsecutivoFe?.trim());
  return {
    noFactu: withFactu?.nafNoFactu?.trim() || null,
    fe: withFe?.nafConsecutivoFe?.trim() || withFactu?.nafConsecutivoFe?.trim() || null,
  };
}

async function lookupOracleNoFactu({ noFisico, fe, companySap, licitacionNo }) {
  const binds = {};
  const conditions = ["f.TIPO_DOC = 'FC'"];
  if (fe) {
    conditions.push("TO_CHAR(f.F_ELECTRONICA) = :fe");
    binds.fe = fe;
  } else if (noFisico && companySap) {
    conditions.push("TO_CHAR(f.NO_FISICO) = :nof");
    conditions.push("f.NO_CIA = :cia");
    binds.nof = noFisico;
    binds.cia = String(companySap).padStart(2, "0");
  } else if (licitacionNo && noFisico) {
    conditions.push("TO_CHAR(f.NO_FISICO) = :nof");
    conditions.push("UPPER(NVL(f.NO_CONTRATO,' ')) LIKE UPPER(:ctr)");
    binds.nof = noFisico;
    binds.ctr = `%${licitacionNo}%`;
  } else {
    return null;
  }

  const sql = `
    SELECT * FROM (
      SELECT TO_CHAR(f.NO_FACTU) NO_FACTU,
             TO_CHAR(f.NO_FISICO) NO_FISICO,
             TO_CHAR(f.F_ELECTRONICA) F_ELECTRONICA,
             f.NO_CIA, f.TOTAL, f.FECHA
      FROM NAF5.ARFAFE f
      WHERE ${conditions.join(" AND ")}
      ORDER BY f.FECHA DESC
    ) WHERE ROWNUM <= 5
  `;
  const r = await global.__nafConn.execute(sql, binds, {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
  });
  const row = r.rows?.[0];
  if (!row?.NO_FACTU) return null;
  return {
    noFactu: String(row.NO_FACTU).trim(),
    fe: row.F_ELECTRONICA ? String(row.F_ELECTRONICA).trim() : null,
  };
}

async function migrateCxcKey(row, newDoc, newInv) {
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

  if (!APPLY) return { ok: true, action: "dry" };

  if (collision && collision.id !== row.id) {
    await prisma.cxcDocumento.update({
      where: { id: collision.id },
      data: {
        facturaMensualId: row.facturaMensualId,
        invoiceNumber: newInv ?? row.invoiceNumber,
        companySapCode,
        documentNumber: newDoc,
      },
    });
    await prisma.cxcDocumento.delete({ where: { id: row.id } });
    return { ok: true, action: "merge" };
  }

  await prisma.cxcDocumento.update({
    where: { id: row.id },
    data: {
      companySapCode,
      documentNumber: newDoc,
      invoiceNumber: newInv ?? row.invoiceNumber,
    },
  });
  return { ok: true, action: "update" };
}

async function main() {
  if (process.env.NAF_ORACLE_CLIENT_DIR) {
    try {
      oracledb.initOracleClient({ libDir: process.env.NAF_ORACLE_CLIENT_DIR });
    } catch (_) {}
  }
  global.__nafConn = await oracledb.getConnection({
    user: process.env.NAF_ORACLE_USER,
    password: process.env.NAF_ORACLE_PASSWORD,
    connectString: process.env.NAF_ORACLE_CONNECT_STRING,
  });

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
      facturaMensual: {
        select: {
          id: true,
          contractId: true,
          documentNumber: true,
          invoiceNumber: true,
          contract: { select: { licitacionNo: true } },
        },
      },
    },
  });

  console.log(`CxC revisados: ${rows.length}${APPLY ? " (APPLY)" : " (dry-run)"}`);

  let updated = 0;
  let merged = 0;
  let skipped = 0;
  let unresolved = 0;

  for (const row of rows) {
    const current = row.documentNumber?.trim() || "";
    // Ya parece NO_FACTU (6+ dígitos y no es FE)
    const alreadyNoFactu =
      /^\d{6,}$/.test(current) && !isFeConsecutivo(current) && !isSyntheticFm(current);

    let resolved = null;

    // 1) Links NAF en Alfa One
    if (row.facturaMensualId) {
      const fromLinks = await pickNoFactuFromLinks(row.facturaMensualId);
      if (fromLinks?.noFactu) resolved = fromLinks;
    }

    // 2) Oracle si el actual parece NO_FISICO o aún no resolvimos
    if (
      !resolved &&
      (looksLikeNoFisicoNotNoFactu(current, row.invoiceNumber) || !alreadyNoFactu)
    ) {
      const licitacionNo = row.facturaMensual?.contract?.licitacionNo ?? null;
      resolved = await lookupOracleNoFactu({
        noFisico: looksLikeNoFisicoNotNoFactu(current, row.invoiceNumber) ? current : null,
        fe: isFeConsecutivo(row.invoiceNumber) ? row.invoiceNumber.trim() : null,
        companySap: row.companySapCode,
        licitacionNo,
      });
      // Si no había noFisico heurístico pero hay FE
      if (!resolved && isFeConsecutivo(row.invoiceNumber)) {
        resolved = await lookupOracleNoFactu({
          noFisico: null,
          fe: row.invoiceNumber.trim(),
          companySap: row.companySapCode,
          licitacionNo,
        });
      }
      // Si current es corto, buscar por NO_FISICO
      if (!resolved && /^\d{1,6}$/.test(current) && !isFeConsecutivo(current)) {
        resolved = await lookupOracleNoFactu({
          noFisico: current,
          fe: null,
          companySap: row.companySapCode,
          licitacionNo,
        });
      }
    }

    if (!resolved?.noFactu) {
      if (alreadyNoFactu) {
        skipped += 1;
        continue;
      }
      unresolved += 1;
      console.log(`  ? ${row.clientName}: ${current} (sin NO_FACTU)`);
      continue;
    }

    if (resolved.noFactu === current) {
      skipped += 1;
      continue;
    }

    console.log(
      `  ${row.clientName}: ${current} → ${resolved.noFactu}` +
        (resolved.fe ? ` (FE ${resolved.fe})` : "")
    );

    const result = await migrateCxcKey(row, resolved.noFactu, resolved.fe || row.invoiceNumber);
    if (result.action === "merge") merged += 1;
    else updated += 1;

    if (APPLY && row.facturaMensualId) {
      await prisma.facturaMensual.update({
        where: { id: row.facturaMensualId },
        data: {
          documentNumber: resolved.noFactu,
          invoiceNumber: resolved.fe || row.invoiceNumber,
        },
      });
      await prisma.facturaMensualEmision.updateMany({
        where: { facturaMensualId: row.facturaMensualId },
        data: {
          documentNumber: resolved.noFactu,
          invoiceNumber: resolved.fe || row.invoiceNumber,
        },
      });
    }
  }

  console.log(`\nActualizados: ${updated}`);
  console.log(`Fusionados: ${merged}`);
  console.log(`Sin cambio: ${skipped}`);
  console.log(`Sin resolver: ${unresolved}`);
  if (!APPLY) console.log("\nDry-run. Reejecutar con --apply para aplicar.");

  await global.__nafConn.close();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
