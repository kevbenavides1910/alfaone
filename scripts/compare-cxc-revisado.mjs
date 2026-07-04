import { readFileSync } from "fs";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// ts-node register for cxc-rows
import { register } from "ts-node";
register({ compilerOptions: { module: "CommonJS" } });
const { cxcMassRowFromSheet, isHeaderCxcMassRow } = require("../src/modules/presupuestos/import/cxc-rows.ts");

function normKey(companySapCode, documentNumber) {
  const sap = String(companySapCode ?? "").trim().replace(/^0+/, "") || "0";
  return `${sap}|${String(documentNumber).trim()}`;
}

const file = "cargas/reporte (47) (1).xlsx";
const wb = XLSX.read(readFileSync(file), { cellDates: true, raw: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Revisado"], { defval: "", raw: true });
const revisadoKeys = new Set();
for (let i = 0; i < rows.length; i++) {
  if (isHeaderCxcMassRow(rows[i])) continue;
  const p = cxcMassRowFromSheet(rows[i], i + 2, true);
  if (!p) continue;
  if (p.docType !== "FC" && p.docType !== "FM" && !p.isReajuste) continue;
  revisadoKeys.add(normKey(p.companySap, p.documentNumber));
}

const prisma = new PrismaClient();
const all = await prisma.cxcDocumento.findMany({
  select: {
    id: true,
    companySapCode: true,
    documentNumber: true,
    importSheet: true,
    status: true,
    clientName: true,
    facturaMensualId: true,
    abonos: { select: { id: true } },
    rebajos: { select: { id: true } },
  },
});

const facturacion = all.filter((d) => !d.importSheet);
const imported = all.filter((d) => d.importSheet);
const allByKey = new Map(all.map((d) => [normKey(d.companySapCode, d.documentNumber), d]));
const importedKeys = new Map(imported.map((d) => [normKey(d.companySapCode, d.documentNumber), d]));

const inRevisadoNotDb = [...revisadoKeys].filter((k) => !allByKey.has(k));
const inDbImportedNotRevisado = [...importedKeys.keys()].filter((k) => !revisadoKeys.has(k));
const inBoth = [...revisadoKeys].filter((k) => importedKeys.has(k));

const withActivity = inDbImportedNotRevisado.filter((k) => {
  const d = importedKeys.get(k);
  return d && (d.abonos.length > 0 || d.rebajos.length > 0 || d.facturaMensualId);
});

console.log("=== COMPARACIÓN Revisado vs BD ===");
console.log(`Archivo: ${file}`);
console.log(`Revisado (FC/FM/reajuste): ${revisadoKeys.size}`);
console.log(`BD importados: ${imported.length}`);
console.log(`BD facturación (no tocar): ${facturacion.length}`);
console.log(`En Revisado y en BD import: ${inBoth.length}`);
console.log(`Faltan en BD: ${inRevisadoNotDb.length}`);
console.log(`Sobrantes import (no en Revisado): ${inDbImportedNotRevisado.length}`);
console.log(`  con abonos/rebajos/factura: ${withActivity.length}`);
if (inRevisadoNotDb.length) console.log("Faltantes:", inRevisadoNotDb.slice(0, 10).join(", "));
if (inDbImportedNotRevisado.length) console.log("Sobrantes:", inDbImportedNotRevisado.slice(0, 10).join(", "));

await prisma.$disconnect();
