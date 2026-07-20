import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canManageExpenses } from "@/lib/api/middleware";
import { created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { readFirstSheetAsObjects } from "@/modules/core/import/xlsx-read";
import {
  collectLicitacionesFromExpenseRows,
  expenseRowFromSheet,
  isEmptyExpenseRow,
  normalizeLicitacionNo,
} from "@/modules/presupuestos/import/expense-rows";
import { expenseImportTemplateBuffer } from "@/modules/presupuestos/import/templates";
import type { ExpenseCreateInput } from "@/modules/presupuestos/validations/expense.schema";
import { Prisma, type ExpenseType } from "@prisma/client";
import { getApprovalStepCountForType, initialApprovalFields } from "@/modules/presupuestos/services/expense-approval";
import { applyDeferredExpenseDistributions } from "@/modules/presupuestos/services/deferred-expense-distribution";
import { splitAmountAcrossMonths } from "@/modules/presupuestos/business/expense-proration";
import { readBoundedUpload } from "@/lib/security/form-upload";

function rowErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    const m = e.message;
    return m.length > 400 ? `${m.slice(0, 400)}…` : m;
  }
  return "Error al guardar en base de datos";
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageExpenses(session)) return forbidden();

  const buf = expenseImportTemplateBuffer();
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla_importar_gastos.xlsx"',
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageExpenses(session)) return forbidden();

  try {
    const form = await req.formData();
    const upload = await readBoundedUpload(form);
    if (!upload.ok) return badRequest(upload.message);

    const rows = readFirstSheetAsObjects(upload.buffer, { preferredName: "Gastos" });

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
    const toInsert: {
      sheetRow: number;
      data: ExpenseCreateInput;
      importApproved: boolean;
    }[] = [];

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
        for (const w of result.warnings) {
          warnings.push({ sheetRow, message: w });
        }
        toInsert.push({
          sheetRow,
          data: result.data,
          importApproved: result.importApproved,
        });
      }
      sheetRow++;
    }

    if (toInsert.length === 0 && errors.length === 0) {
      return badRequest("No hay filas de datos (solo encabezados o filas vacías)");
    }

    const include = {
      contract: { select: { id: true, licitacionNo: true, client: true, company: true } },
      origin: { select: { id: true, name: true } },
    } as const;

    let createdCount = 0;

    const distinctTypes = [...new Set(toInsert.map((t) => t.data.type))] as ExpenseType[];
    const countByType = new Map<ExpenseType, number>();
    await Promise.all(
      distinctTypes.map(async (t) => {
        countByType.set(t, await getApprovalStepCountForType(t));
      })
    );

    for (const { sheetRow, data, importApproved } of toInsert) {
      const {
        periodMonth,
        amount,
        spreadMonths: rawSpread,
        description,
        type,
        budgetLine,
        contractId,
        positionId,
        originId,
        referenceNumber,
        company,
        isDeferred,
        notes,
        registroCxp,
        registroTr,
        deferredIncludeContractIds,
      } = data;

      const spreadMonths = isDeferred ? 1 : rawSpread;
      const [year, month] = periodMonth.split("-").map(Number);
      const start = new Date(year, month - 1, 1);

      const stepCount = countByType.get(type) ?? 0;
      const approval = importApproved
        ? {
            approvalStatus: "APPROVED" as const,
            currentApprovalStep: null,
            requiredApprovalSteps: stepCount,
          }
        : initialApprovalFields(stepCount);

      const common = {
        type,
        budgetLine,
        contractId,
        positionId: positionId || null,
        originId: originId || null,
        referenceNumber: referenceNumber || null,
        company,
        isDeferred,
        notes: notes || null,
        registroCxp: registroCxp?.trim() || null,
        registroTr: registroTr?.trim() || null,
        createdById: session.user.id,
        approvalStatus: approval.approvalStatus,
        currentApprovalStep: approval.currentApprovalStep,
        requiredApprovalSteps: approval.requiredApprovalSteps,
        deferredIncludeContractIds: isDeferred ? (deferredIncludeContractIds ?? []) : [],
        deferredManualDistribution: false,
        deferredManualAllocations: Prisma.JsonNull,
      };

      try {
        if (spreadMonths <= 1) {
          const exp = await prisma.expense.create({
            data: {
              ...common,
              description: description.trim(),
              amount,
              periodMonth: start,
            },
            include,
          });
          if (isDeferred) {
            await applyDeferredExpenseDistributions(prisma, exp.id);
          }
          createdCount++;
          continue;
        }

        const amounts = splitAmountAcrossMonths(amount, spreadMonths);
        const desc = description.trim();
        const createdBatch = await prisma.$transaction(
          amounts.map((amt, i) =>
            prisma.expense.create({
              data: {
                ...common,
                description: `${desc} (mes ${i + 1}/${spreadMonths})`,
                amount: amt,
                periodMonth: new Date(year, month - 1 + i, 1),
              },
              include,
            })
          )
        );
        if (isDeferred) {
          for (const exp of createdBatch) {
            await applyDeferredExpenseDistributions(prisma, exp.id);
          }
        }
        createdCount += amounts.length;
      } catch (e) {
        errors.push({ sheetRow, message: rowErrorMessage(e) });
      }
    }

    const partialMsg =
      createdCount > 0 && errors.length > 0
        ? `Importación parcial: ${createdCount} movimiento(s) guardados; ${errors.length} fila(s) con error.`
        : null;

    const warnMsg =
      warnings.length > 0
        ? ` ${warnings.length} advertencia(s) (reparto manual o subconjunto sin detalle en Excel).`
        : "";

    return created({
      created: createdCount,
      errors,
      warnings,
      message:
        (partialMsg ??
          (createdCount > 0
            ? `Se registraron ${createdCount} movimiento(s) de gasto.`
            : errors.length > 0
              ? "No se importaron filas válidas; revise los errores."
              : "Nada que importar.")) + warnMsg,
    });
  } catch (e) {
    return serverError("Error al importar gastos", e);
  }
}
