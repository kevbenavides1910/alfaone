/**
 * Importa gastos desde Excel (misma lógica que POST /api/import/expenses).
 * Uso: npm run db:import-expenses -- cargas/gastos_2026-05-09.xlsx
 */
import { readFileSync } from "fs";
import path from "path";
import { Prisma, PrismaClient, type ExpenseType } from "@prisma/client";
import { readFirstSheetAsObjects } from "../src/modules/core/import/xlsx-read";
import {
  collectLicitacionesFromExpenseRows,
  expenseRowFromSheet,
  isEmptyExpenseRow,
  normalizeLicitacionNo,
} from "../src/modules/presupuestos/import/expense-rows";
import type { ExpenseCreateInput } from "../src/modules/presupuestos/validations/expense.schema";
import { getApprovalStepCountForType, initialApprovalFields } from "../src/modules/presupuestos/services/expense-approval";
import { applyDeferredExpenseDistributions } from "../src/modules/presupuestos/services/deferred-expense-distribution";

const prisma = new PrismaClient();

function rowErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message.length > 400 ? `${e.message.slice(0, 400)}…` : e.message;
  return "Error al guardar en base de datos";
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Uso: npm run db:import-expenses -- <ruta-al-xlsx>");
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const buf = readFileSync(filePath);
  const rows = readFirstSheetAsObjects(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), {
    preferredName: "Gastos",
  });

  const admin = await prisma.user.findFirst({
    where: { email: "admin@seguridadgrupocr.com" },
    select: { id: true },
  });
  if (!admin) {
    console.error("No existe usuario admin — ejecute npm run db:seed primero.");
    process.exit(1);
  }

  const companyCatalog = await prisma.company.findMany({
    select: { code: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const origins = await prisma.expenseOrigin.findMany({ select: { id: true, name: true } });
  const originIdByName = new Map<string, string>();
  for (const o of origins) {
    const key = o.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    originIdByName.set(key, o.id);
  }

  const licitaciones = collectLicitacionesFromExpenseRows(rows);
  const licitacionSet = new Set(licitaciones.map(normalizeLicitacionNo));
  const contracts =
    licitacionSet.size > 0
      ? (
          await prisma.contract.findMany({
            where: { deletedAt: null },
            select: { id: true, licitacionNo: true, company: true },
          })
        ).filter((c) => licitacionSet.has(normalizeLicitacionNo(c.licitacionNo)))
      : [];
  const contractIdByLicitacion = new Map<string, { id: string; company: string }>();
  for (const c of contracts) {
    const key = c.licitacionNo.trim().replace(/\s+/g, " ");
    contractIdByLicitacion.set(key, { id: c.id, company: c.company });
    contractIdByLicitacion.set(c.licitacionNo.trim(), { id: c.id, company: c.company });
  }

  const errors: { sheetRow: number; message: string }[] = [];
  const warnings: { sheetRow: number; message: string }[] = [];
  const toInsert: { sheetRow: number; data: ExpenseCreateInput; importApproved: boolean }[] = [];

  let sheetRow = 2;
  for (const row of rows) {
    if (isEmptyExpenseRow(row)) {
      sheetRow++;
      continue;
    }
    const result = expenseRowFromSheet(row, sheetRow, contractIdByLicitacion, originIdByName, companyCatalog);
    if (!result.ok) {
      errors.push({ sheetRow: result.sheetRow, message: result.message });
    } else {
      for (const w of result.warnings) warnings.push({ sheetRow, message: w });
      toInsert.push({ sheetRow, data: result.data, importApproved: result.importApproved });
    }
    sheetRow++;
  }

  const distinctTypes = [...new Set(toInsert.map((t) => t.data.type))] as ExpenseType[];
  const countByType = new Map<ExpenseType, number>();
  await Promise.all(
    distinctTypes.map(async (t) => {
      countByType.set(t, await getApprovalStepCountForType(t));
    })
  );

  let createdCount = 0;
  for (const { sheetRow, data, importApproved } of toInsert) {
    const stepCount = countByType.get(data.type) ?? 0;
    const approval = importApproved
      ? { approvalStatus: "APPROVED" as const, currentApprovalStep: null, requiredApprovalSteps: stepCount }
      : initialApprovalFields(stepCount);

    const [year, month] = data.periodMonth.split("-").map(Number);
    const start = new Date(year, month - 1, 1);

    try {
      const exp = await prisma.expense.create({
        data: {
          type: data.type,
          budgetLine: data.budgetLine,
          description: data.description.trim(),
          amount: data.amount,
          periodMonth: start,
          contractId: data.contractId ?? null,
          originId: data.originId ?? null,
          referenceNumber: data.referenceNumber ?? null,
          company: data.company,
          isDeferred: data.isDeferred,
          notes: data.notes ?? null,
          registroCxp: data.registroCxp?.trim() || null,
          registroTr: data.registroTr?.trim() || null,
          createdById: admin.id,
          approvalStatus: approval.approvalStatus,
          currentApprovalStep: approval.currentApprovalStep,
          requiredApprovalSteps: approval.requiredApprovalSteps,
          deferredIncludeContractIds: data.isDeferred ? (data.deferredIncludeContractIds ?? []) : [],
          deferredManualDistribution: false,
          deferredManualAllocations: Prisma.JsonNull,
        },
      });
      if (data.isDeferred) {
        await applyDeferredExpenseDistributions(prisma, exp.id);
      }
      createdCount++;
    } catch (e) {
      errors.push({ sheetRow, message: rowErrorMessage(e) });
    }
  }

  console.log("\n=== Importación de gastos ===");
  console.log(`Archivo: ${filePath}`);
  console.log(`Filas en hoja: ${rows.length}`);
  console.log(`Creados: ${createdCount}`);
  console.log(`Errores: ${errors.length}`);
  console.log(`Advertencias: ${warnings.length}`);
  if (errors.length) {
    console.log("\nErrores:");
    for (const e of errors.slice(0, 15)) console.log(`  Fila ${e.sheetRow}: ${e.message}`);
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
