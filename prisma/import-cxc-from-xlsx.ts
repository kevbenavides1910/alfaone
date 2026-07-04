/**
 * Importa cuentas por cobrar desde Excel (solo hoja «Revisado»).
 * Crea un CxcDocumento por cada fila FC/FM; reajustes quedan como documentos de tipo reajuste.
 * Uso:
 *   npm run db:import-cxc -- cargas/mi_archivo.xlsx
 *   npm run db:import-cxc -- --reset-import cargas/mi_archivo.xlsx
 *   npm run db:import-cxc -- --list-sheets cargas/mi_archivo.xlsx
 *   npm run db:import-cxc -- --legacy-sheets cargas/cxc_carga_masiva.xlsx
 */
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  listWorkbookSheetNames,
  readSheetsByAliases,
} from "../src/modules/core/import/xlsx-read";
import {
  addDaysUtc,
  cxcMassRowFromSheet,
  formatCxcImportObservation,
  formatDocumentReajusteObservation,
  isCxcSectionHeaderRow,
  isHeaderCxcMassRow,
  periodFromDate,
  scoreClientName,
  type ParsedCxcMassRow,
} from "../src/modules/presupuestos/import/cxc-rows";

const prisma = new PrismaClient();

type ContractRow = {
  id: string;
  licitacionNo: string;
  client: string;
  company: string;
};

type FacturaRow = {
  id: string;
  contractId: string;
  periodYear: number;
  periodMonth: number;
  documentNumber: string | null;
};

async function resetCxcImportData() {
  const deleted = await prisma.cxcDocumento.deleteMany({});
  console.log(`Documentos CxC eliminados: ${deleted.count}.`);

  const affected = await prisma.facturaMensual.findMany({
    where: {
      OR: [
        { cxcObservations: { contains: "CxC doc " } },
        { cxcObservations: { contains: "Reajuste " } },
        { status: { in: ["FACTURADO", "COBRADO"] } },
        { documentNumber: { not: null } },
      ],
    },
    select: { id: true },
  });

  if (affected.length > 0) {
    await prisma.facturaMensual.updateMany({
      where: { id: { in: affected.map((f) => f.id) } },
      data: {
        status: "PENDIENTE",
        closedAt: null,
        paidAt: null,
        lastPaymentReviewAt: null,
        cxcObservations: null,
        documentNumber: null,
        invoiceNumber: null,
        provisionalReceiptNumber: null,
        provisionalPaymentAmount: null,
        cxcExpectedPaymentDate: null,
        invoiceReceivedAt: null,
        servicePeriodFromDate: null,
        servicePeriodToDate: null,
      },
    });
    console.log(`Facturas mensuales revertidas: ${affected.length}.`);
  }

  return deleted.count;
}

/** Elimina solo documentos creados por importación Excel (conserva los generados desde facturación). */
async function resetImportedCxcDocuments() {
  const deleted = await prisma.cxcDocumento.deleteMany({
    where: { importSheet: { not: null } },
  });
  console.log(`Documentos CxC de importación eliminados: ${deleted.count}.`);
  return deleted.count;
}

function resolveContract(
  row: ParsedCxcMassRow,
  companyCode: string | null,
  contracts: ContractRow[]
): ContractRow | null {
  if (!row.clientName) return null;

  let candidates = contracts;
  if (companyCode) {
    const byCompany = contracts.filter((c) => c.company === companyCode);
    if (byCompany.length > 0) candidates = byCompany;
  }

  let best: ContractRow | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = scoreClientName(row.clientName, c.client);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return bestScore >= 55 ? best : null;
}

function pickTargetFactura(contractFacturas: FacturaRow[], row: ParsedCxcMassRow): FacturaRow | null {
  const byDoc = contractFacturas.find((f) => f.documentNumber === row.documentNumber);
  if (byDoc) return byDoc;

  const periodDate = row.servicePeriodDate ?? row.documentDate;
  if (periodDate) {
    const { year, month } = periodFromDate(periodDate);
    const byPeriod = contractFacturas.find((f) => f.periodYear === year && f.periodMonth === month);
    if (byPeriod) return byPeriod;
  }

  if (row.documentDate) {
    const { year, month } = periodFromDate(row.documentDate);
    const byIssue = contractFacturas.find((f) => f.periodYear === year && f.periodMonth === month);
    if (byIssue) return byIssue;
  }

  return contractFacturas[contractFacturas.length - 1] ?? null;
}

function buildDocumentData(
  parsed: ParsedCxcMassRow,
  sheetName: string,
  companyCode: string | null,
  contract: ContractRow | null,
  factura: FacturaRow | null
) {
  const montoOriginal = parsed.montoOriginal ?? 0;
  const saldo = parsed.saldo ?? montoOriginal;
  const abono =
    montoOriginal > 0 && saldo >= 0 && saldo < montoOriginal
      ? Math.round((montoOriginal - saldo) * 100) / 100
      : null;

  let dueDate: Date | undefined;
  if (parsed.documentDate && parsed.plazoDays != null) {
    dueDate = addDaysUtc(parsed.documentDate, parsed.plazoDays);
  } else if (parsed.diasParaVencer != null) {
    dueDate = addDaysUtc(new Date(), parsed.diasParaVencer);
  }

  const observation = parsed.isReajuste
    ? formatDocumentReajusteObservation(parsed)
    : formatCxcImportObservation(parsed);

  const cobrado = saldo <= 0;

  return {
    contractId: contract?.id ?? null,
    facturaMensualId: factura?.id ?? null,
    companySapCode: parsed.companySap || "—",
    companyCode,
    documentNumber: parsed.documentNumber,
    invoiceNumber: parsed.invoiceNumber,
    repeats: parsed.repeats,
    docType: parsed.docType,
    documentDate: parsed.documentDate,
    invoiceReceivedAt: parsed.documentDate,
    servicePeriodDate: parsed.servicePeriodDate,
    montoOriginal: montoOriginal > 0 ? montoOriginal : null,
    saldo,
    clientSapCode: parsed.clientSapCode,
    clientName: parsed.clientName,
    plazoDays: parsed.plazoDays,
    diasVencido: parsed.diasVencido,
    diasParaVencer: parsed.diasParaVencer,
    montoVencido: parsed.montoVencido,
    revisarDias: parsed.revisarDias,
    dueDate: dueDate ?? null,
    cxcExpectedPaymentDate: dueDate ?? null,
    provisionalReceiptNumber: abono != null && abono > 0 ? parsed.documentNumber : null,
    provisionalPaymentAmount: abono,
    cxcObservations: observation,
    status: cobrado ? ("COBRADO" as const) : ("PENDIENTE" as const),
    paidAt: cobrado ? parsed.documentDate ?? new Date() : null,
    isReajuste: parsed.isReajuste,
    importSheet: sheetName,
    importSheetRow: parsed.sheetRow,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const resetAll = args.includes("--reset");
  const resetImport = args.includes("--reset-import");
  const listSheets = args.includes("--list-sheets");
  const legacySheets = args.includes("--legacy-sheets");
  const fileArg = args.find((a) => !a.startsWith("--")) ?? "cargas/reporte (47) (1).xlsx";
  const filePath = path.resolve(process.cwd(), fileArg);

  const buf = readFileSync(filePath);
  const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  if (listSheets) {
    console.log(`Archivo: ${filePath}`);
    console.log(`Hojas: ${listWorkbookSheetNames(arrayBuf).join(", ")}`);
    return;
  }

  if (resetAll) {
    await resetCxcImportData();
  } else if (resetImport) {
    await resetImportedCxcDocuments();
  }

  const companies = await prisma.company.findMany({ select: { code: true, sapCode: true } });
  const companyBySap = new Map<string, string>();
  for (const c of companies) {
    if (!c.sapCode) continue;
    companyBySap.set(c.sapCode, c.code);
    companyBySap.set(String(parseInt(c.sapCode, 10)), c.code);
  }

  const contracts = await prisma.contract.findMany({
    where: { deletedAt: null },
    select: { id: true, licitacionNo: true, client: true, company: true },
  });

  const facturas = await prisma.facturaMensual.findMany({
    select: {
      id: true,
      contractId: true,
      periodYear: true,
      periodMonth: true,
      documentNumber: true,
    },
    orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
  });
  const facturasByContract = new Map<string, FacturaRow[]>();
  for (const f of facturas) {
    const list = facturasByContract.get(f.contractId) ?? [];
    list.push(f);
    facturasByContract.set(f.contractId, list);
  }

  const warnings: { sheet: string; sheetRow: number; message: string }[] = [];
  let imported = 0;
  let reajustes = 0;
  let withContract = 0;
  let withoutContract = 0;
  let pending = 0;

  async function processRows(
    rows: Record<string, unknown>[],
    sheetName: string,
    opts?: { dynamicSections?: boolean; initialHasContract?: boolean },
  ) {
    let hasContractHint = opts?.initialHasContract ?? true;
    let sheetRow = 2;
    for (const row of rows) {
      if (opts?.dynamicSections) {
        const section = isCxcSectionHeaderRow(row);
        if (section) {
          hasContractHint = section === "contratos";
          sheetRow++;
          continue;
        }
      }

      if (isHeaderCxcMassRow(row)) {
        sheetRow++;
        continue;
      }
      const parsed = cxcMassRowFromSheet(row, sheetRow, hasContractHint);
      sheetRow++;
      if (!parsed) continue;
      if (parsed.docType !== "FC" && parsed.docType !== "FM" && !parsed.isReajuste) continue;

      const companyCode = companyBySap.get(parsed.companySap) ?? null;
      const contract = resolveContract(parsed, companyCode, contracts);
      const factura = contract
        ? pickTargetFactura(facturasByContract.get(contract.id) ?? [], parsed)
        : null;

      if (contract) withContract++;
      else {
        withoutContract++;
        if (hasContractHint) {
          warnings.push({
            sheet: sheetName,
            sheetRow: parsed.sheetRow,
            message: `Sin contrato para «${parsed.clientName}» (${parsed.docType} ${parsed.documentNumber})`,
          });
        }
      }

      const data = buildDocumentData(parsed, sheetName, companyCode, contract, factura);

      await prisma.cxcDocumento.upsert({
        where: {
          companySapCode_documentNumber: {
            companySapCode: data.companySapCode,
            documentNumber: data.documentNumber,
          },
        },
        create: data,
        update: data,
      });

      imported++;
      if (parsed.isReajuste) reajustes++;
      if (data.status === "PENDIENTE") pending++;
    }
  }

  if (legacySheets) {
    const sheets = readSheetsByAliases(arrayBuf, {
      contratos: ["Contratos"],
      sinContrato: ["Sin Contrato", "sin contrato"],
    });
    await processRows(sheets.contratos ?? [], "Contratos", { initialHasContract: true });
    await processRows(sheets.sinContrato ?? [], "Sin Contrato", { initialHasContract: false });
  } else {
    const sheets = readSheetsByAliases(arrayBuf, {
      revisado: ["Revisado", "revisado", "REVISADO"],
    });
    const revisadoRows = sheets.revisado;
    if (!revisadoRows || revisadoRows.length === 0) {
      const names = listWorkbookSheetNames(arrayBuf);
      console.error(`No se encontró la hoja «Revisado» en ${filePath}.`);
      console.error(`Hojas disponibles: ${names.join(", ")}`);
      console.error("Use --list-sheets para listar hojas o --legacy-sheets si el archivo tiene Contratos / Sin Contrato.");
      process.exit(1);
    }
    await processRows(revisadoRows, "Revisado", {
      dynamicSections: true,
      initialHasContract: true,
    });
  }

  console.log("\n=== Importación CxC (carga masiva) ===");
  console.log(`Archivo: ${filePath}`);
  console.log(
    legacySheets
      ? "Modo: hojas Contratos + Sin Contrato (--legacy-sheets)"
      : "Modo: solo hoja Revisado",
  );
  console.log(`Documentos importados: ${imported}`);
  console.log(`Pendientes de cobro (saldo > 0): ${pending}`);
  console.log(`Con contrato vinculado: ${withContract}`);
  console.log(`Sin contrato: ${withoutContract}`);
  console.log(`Reajustes: ${reajustes}`);
  console.log(`Advertencias: ${warnings.length}`);

  if (warnings.length > 0) {
    console.log("\nPrimeras advertencias:");
    for (const w of warnings.slice(0, 15)) {
      console.log(`  [${w.sheet}] Fila ${w.sheetRow}: ${w.message}`);
    }
    if (warnings.length > 15) console.log(`  … y ${warnings.length - 15} más`);
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
