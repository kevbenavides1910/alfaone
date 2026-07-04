/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

require("ts-node/register/transpile-only");
const { cxcMassRowFromSheet, isHeaderCxcMassRow } = require("../src/modules/presupuestos/import/cxc-rows");

function normKey(sap, doc) {
  const s = String(sap ?? "")
    .trim()
    .replace(/^0+/, "") || "0";
  return `${s}|${String(doc).trim()}`;
}

const file = path.join(__dirname, "../cargas/reporte (47) (1).xlsx");
const wb = XLSX.read(fs.readFileSync(file), { cellDates: true, raw: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Revisado"], { defval: "", raw: true });
const revisadoKeys = new Set();

for (let i = 0; i < rows.length; i++) {
  if (isHeaderCxcMassRow(rows[i])) continue;
  const p = cxcMassRowFromSheet(rows[i], i + 2, true);
  if (!p || (p.docType !== "FC" && p.docType !== "FM" && !p.isReajuste)) continue;
  revisadoKeys.add(normKey(p.companySap, p.documentNumber));
}

const dbFile = process.argv[2] || "/tmp/cxc_db_keys.txt";
const dbLines = fs.readFileSync(dbFile, "utf8").trim().split("\n").filter(Boolean);
const all = dbLines.map((l) => {
  const parts = l.split("|");
  return { k: parts[0], sheet: parts[1] || "", status: parts[2], id: parts[3] };
});
const fact = all.filter((d) => !d.sheet);
const imp = all.filter((d) => d.sheet);
const impMap = new Map(imp.map((d) => [d.k, d]));

const faltan = [...revisadoKeys].filter((k) => !all.some((d) => d.k === k));
const sobran = imp.filter((d) => !revisadoKeys.has(d.k));
const enAmbos = [...revisadoKeys].filter((k) => impMap.has(k));

console.log("=== COMPARACIÓN Revisado vs BD ===");
console.log(`Revisado (FC/FM): ${revisadoKeys.size}`);
console.log(`BD total: ${all.length} | facturación (no tocar): ${fact.length} | import: ${imp.length}`);
console.log(`Coinciden import+Revisado: ${enAmbos.length}`);
console.log(`Faltan en BD: ${faltan.length}`);
console.log(`Sobran import (no en Revisado): ${sobran.length}`);
console.log(`Revisado ya en facturación: ${[...revisadoKeys].filter((k) => fact.some((d) => d.k === k)).length}`);
if (faltan.length) console.log("Faltantes:", faltan.slice(0, 8).join(", "));
if (sobran.length) console.log("Sobrantes:", sobran.slice(0, 8).map((d) => d.k).join(", "));
