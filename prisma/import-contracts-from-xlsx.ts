/**
 * Importa contratos desde un Excel (misma lógica que POST /api/import/contracts).
 * Uso: npm run db:import-contracts -- cargas/contratos_2026-05-09.xlsx
 */
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { readFirstSheetAsObjects } from "../src/modules/core/import/xlsx-read";
import type { ContractCreateInput } from "../src/modules/presupuestos/validations/contract.schema";
import { contractRowFromSheet, isEmptyContractRow } from "../src/modules/presupuestos/import/contract-rows";
import { recalculateEquivalence } from "../src/modules/presupuestos/business/equivalence";

const prisma = new PrismaClient();

function rowErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message.length > 400 ? `${e.message.slice(0, 400)}…` : e.message;
  return "Error al guardar en base de datos";
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Uso: npm run db:import-contracts -- <ruta-al-xlsx>");
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const buf = readFileSync(filePath);
  const rows = readFirstSheetAsObjects(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), {
    preferredName: "Contratos",
  });

  const admin = await prisma.user.findFirst({
    where: { email: "admin@seguridadgrupocr.com" },
    select: { id: true },
  });
  if (!admin) {
    console.error("No existe usuario admin@seguridadgrupocr.com — ejecute npm run db:seed primero.");
    process.exit(1);
  }

  const companyCatalog = await prisma.company.findMany({
    select: { code: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const parsedRows: { sheetRow: number; data: ContractCreateInput }[] = [];
  const errors: { sheetRow: number; message: string }[] = [];
  const seenLicit = new Set<string>();

  let sheetRow = 2;
  for (const row of rows) {
    if (isEmptyContractRow(row)) {
      sheetRow++;
      continue;
    }
    const result = contractRowFromSheet(row, sheetRow, companyCatalog);
    if (!result.ok) {
      errors.push({ sheetRow: result.sheetRow, message: result.message });
      sheetRow++;
      continue;
    }
    const lic = result.data.licitacionNo.trim();
    if (seenLicit.has(lic)) {
      errors.push({ sheetRow, message: `Licitación duplicada en el archivo: ${lic}` });
      sheetRow++;
      continue;
    }
    seenLicit.add(lic);
    parsedRows.push({ sheetRow, data: result.data });
    sheetRow++;
  }

  const existing =
    seenLicit.size === 0
      ? []
      : await prisma.contract.findMany({
          where: { licitacionNo: { in: [...seenLicit] } },
          select: { licitacionNo: true },
        });
  const existingSet = new Set(existing.map((e) => e.licitacionNo));
  const toCreate = parsedRows.filter((p) => !existingSet.has(p.data.licitacionNo));
  const skippedExisting = parsedRows.length - toCreate.length;

  let createdCount = 0;
  for (const { sheetRow, data } of toCreate) {
    try {
      await prisma.$transaction(async (tx) => {
        const contract = await tx.contract.create({
          data: {
            ...data,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            monthlyBilling: data.monthlyBilling,
            suppliesBudgetPct: data.suppliesPct,
            createdById: admin.id,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: admin.id,
            contractId: contract.id,
            entityType: "Contract",
            entityId: contract.id,
            action: "CREATE",
            newData: JSON.stringify(contract),
          },
        });
      });
      createdCount++;
    } catch (e) {
      errors.push({ sheetRow, message: rowErrorMessage(e) });
    }
  }

  if (createdCount > 0) {
    await recalculateEquivalence();
  }

  console.log("\n=== Importación de contratos ===");
  console.log(`Archivo: ${filePath}`);
  console.log(`Filas en hoja: ${rows.length}`);
  console.log(`Creados: ${createdCount}`);
  console.log(`Omitidos (ya existían): ${skippedExisting}`);
  console.log(`Errores: ${errors.length}`);
  if (errors.length > 0) {
    console.log("\nPrimeros errores:");
    for (const e of errors.slice(0, 20)) {
      console.log(`  Fila ${e.sheetRow}: ${e.message}`);
    }
    if (errors.length > 20) console.log(`  … y ${errors.length - 20} más`);
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
