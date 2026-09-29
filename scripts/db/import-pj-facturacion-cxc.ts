/**
 * Importa cuentas por cobrar desde listado SAP de Poder Judicial (BENA).
 * Hojas: «consulta (…)» o «Listado de facturación».
 * Columnas: Tipo Doc, Documento, Fecha, Cliente, Factura, Doc Fisico, Sub Total, Total, Tarifa, Iva.
 *
 * Uso:
 *   npx tsx scripts/db/import-pj-facturacion-cxc.ts --dry-run "cargas/Copia de DETALLE DE FACTURACIÓN JULIO 2026.xlsx"
 *   npx tsx scripts/db/import-pj-facturacion-cxc.ts --apply "cargas/Copia de DETALLE DE FACTURACIÓN JULIO 2026.xlsx"
 *   npx tsx scripts/db/import-pj-facturacion-cxc.ts --list-sheets "cargas/..."
 */
import { readFileSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { listWorkbookSheetNames } from "../../src/modules/core/import/xlsx-read";
import {
  formatCxcImportObservation,
  periodFromDate,
  type ParsedCxcMassRow,
} from "../../src/modules/presupuestos/import/cxc-rows";
import { normalizeCompanySapCode } from "../../src/modules/presupuestos/services/sync-cxc-from-factura";

const prisma = new PrismaClient();

const COMPANY_CODE = "BENA";
const COMPANY_SAP = "4";

type PjRow = {
  sheetRow: number;
  docType: string;
  documentNumber: string;
  documentDate: Date | null;
  clientName: string;
  invoiceNumber: string | null;
  docFisico: string | null;
  subtotal: number | null;
  total: number;
  ivaPct: number;
};

function str(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function excelSerialToDate(serial: unknown): Date | null {
  if (serial instanceof Date && !Number.isNaN(serial.getTime())) {
    return new Date(Date.UTC(serial.getUTCFullYear(), serial.getUTCMonth(), serial.getUTCDate()));
  }
  const raw = str(serial);
  if (!raw) return null;
  const n = typeof serial === "number" ? serial : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  return new Date(epoch.getTime() + Math.floor(n) * 86400000);
}

function documentNumberFromCell(raw: unknown): string {
  const s = str(raw);
  if (!s) return "";
  const n = Number(s.replace(/,/g, ""));
  if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
  return s;
}

function formatInvoiceNumber(raw: unknown): string | null {
  const s = str(raw).replace(/^['"]+/, "");
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(20, "0");
}

function pickSheetName(names: string[]): string | null {
  const consulta = names.find((n) => /^consulta/i.test(n));
  if (consulta) return consulta;
  const listado = names.find((n) => /listado\s+de\s+facturaci[oó]n/i.test(n));
  if (listado) return listado;
  return names[0] ?? null;
}

function parsePjRow(row: Record<string, unknown>, sheetRow: number): PjRow | null {
  const docType = str(row["Tipo Doc"]).toUpperCase();
  const documentNumber = documentNumberFromCell(row["Documento"]);
  if (!docType || !documentNumber) return null;
  if (/^tipo/i.test(docType)) return null;

  const total = num(row[" Total "] ?? row["Total"]);
  if (total == null || total <= 0) return null;

  return {
    sheetRow,
    docType,
    documentNumber,
    documentDate: excelSerialToDate(row["Fecha"]),
    clientName: str(row["Cliente"]) || "PODER JUDICIAL",
    invoiceNumber: formatInvoiceNumber(row["Factura"]),
    docFisico: documentNumberFromCell(row["Doc Fisico"]) || null,
    subtotal: num(row[" Sub Total "] ?? row["Sub Total"]),
    total,
    ivaPct: num(row[" Tarifa "] ?? row["Tarifa"]) ?? 0,
  };
}

function resolvePjContract(
  contracts: { id: string; client: string; company: string }[],
  ivaPct: number
) {
  const bena = contracts.filter((c) => c.company === COMPANY_CODE);
  const gravado = bena.find((c) => /gravado/i.test(c.client));
  const exento = bena.find((c) => /excento|exento/i.test(c.client));
  if (ivaPct > 0) return gravado ?? bena[0] ?? null;
  return exento ?? bena[0] ?? null;
}

function pickFactura(
  facturas: {
    id: string;
    periodYear: number;
    periodMonth: number;
    documentNumber: string | null;
    status: string;
    closedAt: Date | null;
  }[],
  documentNumber: string,
  documentDate: Date | null
) {
  const closed = facturas.filter(
    (f) => (f.status === "FACTURADO" || f.status === "COBRADO") && f.closedAt
  );
  const byDoc = closed.find((f) => f.documentNumber === documentNumber);
  if (byDoc) return byDoc;
  if (!documentDate) return null;
  const { year, month } = periodFromDate(documentDate);
  return closed.find((f) => f.periodYear === year && f.periodMonth === month) ?? null;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = !apply;
  const listSheets = args.includes("--list-sheets");
  const fileArg =
    args.find((a) => !a.startsWith("--")) ??
    "cargas/Listado de facturación PJ Junio 26.xlsx";
  const filePath = path.resolve(process.cwd(), fileArg);

  const buf = readFileSync(filePath);
  const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  if (listSheets) {
    console.log(`Archivo: ${filePath}`);
    console.log(`Hojas: ${listWorkbookSheetNames(arrayBuf).join(", ")}`);
    return;
  }

  const wb = XLSX.read(arrayBuf, { type: "array" });
  const sheetName = pickSheetName(wb.SheetNames);
  if (!sheetName) throw new Error("El archivo no tiene hojas");

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
  const parsed: PjRow[] = [];
  let sheetRow = 2;
  for (const row of rawRows) {
    const p = parsePjRow(row, sheetRow);
    sheetRow++;
    if (p && (p.docType === "FC" || p.docType === "FM")) parsed.push(p);
  }

  if (parsed.length === 0) {
    console.error(`No se encontraron filas FC/FM en la hoja «${sheetName}».`);
    process.exit(1);
  }

  const contracts = await prisma.contract.findMany({
    where: { deletedAt: null, company: COMPANY_CODE },
    select: { id: true, client: true, company: true, licitacionNo: true },
  });

  const facturas = await prisma.facturaMensual.findMany({
    where: { companyCodeCopied: COMPANY_CODE },
    select: {
      id: true,
      contractId: true,
      periodYear: true,
      periodMonth: true,
      documentNumber: true,
      status: true,
      closedAt: true,
    },
  });
  const facturasByContract = new Map<string, typeof facturas>();
  for (const f of facturas) {
    const list = facturasByContract.get(f.contractId) ?? [];
    list.push(f);
    facturasByContract.set(f.contractId, list);
  }

  const companySapCode = normalizeCompanySapCode(COMPANY_SAP, COMPANY_CODE);
  let imported = 0;
  let gravado = 0;
  let exento = 0;
  let linked = 0;
  const warnings: string[] = [];

  console.log(dryRun ? "[DRY-RUN]" : "[APPLY]", filePath);
  console.log(`Hoja: ${sheetName} · Filas FC/FM: ${parsed.length}`);

  for (const row of parsed) {
    const contract = resolvePjContract(contracts, row.ivaPct);
    if (!contract) {
      warnings.push(`Fila ${row.sheetRow}: sin contrato BENA (${row.documentNumber})`);
      continue;
    }
    if (row.ivaPct > 0) gravado++;
    else exento++;

    const factura = pickFactura(
      facturasByContract.get(contract.id) ?? [],
      row.documentNumber,
      row.documentDate
    );
    if (factura) linked++;

    const parsedObs: ParsedCxcMassRow = {
      companySap: companySapCode,
      documentNumber: row.documentNumber,
      invoiceNumber: row.invoiceNumber,
      repeats: null,
      docType: row.docType,
      documentDate: row.documentDate,
      servicePeriodDate: row.documentDate,
      montoOriginal: row.total,
      saldo: row.total,
      clientSapCode: null,
      clientName: row.clientName,
      plazoDays: null,
      diasVencido: null,
      diasParaVencer: null,
      montoVencido: null,
      revisarDias: null,
      isReajuste: false,
      hasContractHint: true,
      sheetRow: row.sheetRow,
    };

    const data = {
      contractId: contract.id,
      facturaMensualId: factura?.id ?? null,
      companySapCode,
      companyCode: COMPANY_CODE,
      documentNumber: row.documentNumber,
      invoiceNumber: row.invoiceNumber,
      repeats: row.docFisico,
      docType: row.docType,
      documentDate: row.documentDate,
      invoiceReceivedAt: row.documentDate,
      servicePeriodDate: row.documentDate,
      montoOriginal: row.total,
      saldo: row.total,
      clientSapCode: null,
      clientName: contract.client,
      plazoDays: null,
      diasVencido: null,
      diasParaVencer: null,
      montoVencido: null,
      revisarDias: null,
      dueDate: row.documentDate,
      cxcExpectedPaymentDate: row.documentDate,
      provisionalReceiptNumber: null,
      provisionalPaymentAmount: null,
      cxcObservations: formatCxcImportObservation(parsedObs),
      status: "PENDIENTE" as const,
      paidAt: null,
      isReajuste: false,
      importSheet: sheetName,
      importSheetRow: row.sheetRow,
    };

    console.log(
      `  ${row.documentNumber} · ${contract.client.slice(0, 22)} · ₡${row.total.toLocaleString("es-CR")} · ${row.invoiceNumber ?? "—"}`
    );

    if (apply) {
      await prisma.cxcDocumento.upsert({
        where: {
          companySapCode_documentNumber: {
            companySapCode,
            documentNumber: row.documentNumber,
          },
        },
        create: data,
        update: data,
      });
    }
    imported++;
  }

  console.log("\n=== Importación CxC PJ ===");
  console.log(`Documentos: ${imported}`);
  console.log(`Gravado (IVA>0): ${gravado} · Exento: ${exento}`);
  console.log(`Vinculados a factura mensual: ${linked}`);
  console.log(`Advertencias: ${warnings.length}`);
  if (warnings.length) {
    for (const w of warnings.slice(0, 10)) console.log(" ", w);
  }
  if (dryRun) console.log("\nEjecute con --apply para guardar en la base de datos.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
