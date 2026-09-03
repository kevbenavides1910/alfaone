import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { withPermission } from "@/lib/permissions/middleware";
import {
  ok,
  created,
  badRequest,
  conflict,
  notFound,
  serverError,
} from "@/lib/api/response";
import {
  getCalendarMonth,
  searchPaymentsByOc,
  serializeSinglePayment,
} from "@/modules/pagos/services/pagos";
import {
  scheduleExpensePayment,
  createPaymentFromProveedorExpenses,
  ScheduleExpenseError,
} from "@/modules/pagos/services/pago-proveedores";
import { validatePaymentClassification } from "@/modules/pagos/catalog/payment-categories";

/**
 * API del módulo Pagos (calendario).
 *   GET  /api/pagos?month=YYYY-MM[&company=...]
 *        → calendario del mes (días con sus pagos y totales)
 *   GET  /api/pagos?oc=...[&company=...]
 *        → búsqueda por número de OC en todos los meses (lista plana)
 *   POST /api/pagos
 *        { source:'MANUAL', description, amount, paymentDate, company?, refType?, referenceNumber?, notes?, category?, subcategory?, expenseId?, expenseIds? }
 *        Crear un pago manual. Con expenseId(s) liquida gastos de «Pago proveedores»
 *        (uno o varios OC en un solo movimiento) y los saca de la cola. También acepta source='APEX'.
 */
export const GET = withPermission(
async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company")?.trim() || undefined;
    const oc = searchParams.get("oc")?.trim() || "";

    if (oc) {
      if (oc.length < 2) {
        return badRequest("Ingresá al menos 2 caracteres del número de OC");
      }
      const results = await searchPaymentsByOc(oc, company);
      return ok(results);
    }

    const month = searchParams.get("month") ?? currentMonth();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return badRequest("Formato de mes inválido (esperado YYYY-MM)");
    }
    const calendar = await getCalendarMonth(month, company);
    return ok(calendar);
  } catch (e) {
    return serverError("Error al obtener el calendario de pagos", e);
  }
},
"pagos.calendario",
);

export const POST = withPermission(
  async (req: NextRequest, ctx: { session: import("next-auth").Session }) => {
    try {
      const body = await req.json();
      const source: string = body.source ?? "MANUAL";

      if (source === "MANUAL") {
        const {
          description,
          amount,
          paymentDate,
          company,
          refType,
          referenceNumber,
          notes,
          category,
          subcategory,
          expenseId,
          expenseIds,
        } = body;
        if (!description || typeof description !== "string") {
          return badRequest("La descripción es obligatoria");
        }
        const amountNum = Number(amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          return badRequest("El monto debe ser un número mayor a 0");
        }
        const date = parseDate(paymentDate);
        if (!date) return badRequest("La fecha de pago es inválida o falta");

        const classification = validatePaymentClassification(
          typeof category === "string" || category === null ? category : undefined,
          typeof subcategory === "string" || subcategory === null ? subcategory : undefined,
        );
        if (!classification.ok) return badRequest(classification.message);

        const linkedExpenseIds: string[] = [];
        if (Array.isArray(expenseIds)) {
          for (const id of expenseIds) {
            if (typeof id === "string" && id.trim()) linkedExpenseIds.push(id.trim());
          }
        }
        if (typeof expenseId === "string" && expenseId.trim()) {
          linkedExpenseIds.push(expenseId.trim());
        }
        const uniqueExpenseIds = [...new Set(linkedExpenseIds)];

        // Ligar a gasto(s) de «Pago proveedores»: un movimiento, salen de la cola.
        if (uniqueExpenseIds.length > 0) {
          const userId = ctx.session.user?.id;
          if (!userId) return badRequest("Sesión sin usuario");
          try {
            if (uniqueExpenseIds.length === 1) {
              const scheduled = await scheduleExpensePayment({
                expenseId: uniqueExpenseIds[0],
                paymentDate: paymentDate.trim(),
                userId,
              });
              const updated = await prisma.payment.update({
                where: { id: scheduled.id },
                data: {
                  description: description.trim(),
                  amount: new Prisma.Decimal(amountNum.toFixed(2)),
                  company: company?.trim() || null,
                  refType: refType?.trim() || null,
                  referenceNumber: referenceNumber?.trim() || null,
                  notes: notes || null,
                  category: classification.category,
                  subcategory: classification.subcategory,
                  updatedById: userId,
                },
              });
              return created(serializeSinglePayment(updated));
            }

            const consolidated = await createPaymentFromProveedorExpenses({
              expenseIds: uniqueExpenseIds,
              paymentDate: paymentDate.trim(),
              userId,
              description: description.trim(),
              amount: amountNum,
              company: company?.trim() || null,
              notes: notes || null,
              category: classification.category,
              subcategory: classification.subcategory,
              referenceNumber: referenceNumber?.trim() || null,
            });
            return created(consolidated);
          } catch (e) {
            if (e instanceof ScheduleExpenseError) {
              if (e.code === "NOT_FOUND") return notFound(e.message);
              if (e.code === "CONFLICT") return conflict(e.message);
              return badRequest(e.message);
            }
            throw e;
          }
        }

        const payment = await prisma.payment.create({
          data: {
            source: "MANUAL",
            description,
            amount: new Prisma.Decimal(amountNum.toFixed(2)),
            paymentDate: date,
            company: company?.trim() || null,
            refType: refType?.trim() || null,
            referenceNumber: referenceNumber?.trim() || null,
            notes: notes || null,
            category: classification.category,
            subcategory: classification.subcategory,
          },
        });
        return created(serializeSinglePayment(payment));
      }

      if (source === "APEX") {
        const apexPagoId = Number(body.apexPagoId);
        if (!Number.isInteger(apexPagoId)) {
          return badRequest("Se requiere apexPagoId para crear un pago APEX");
        }
        const payment = await prisma.payment.upsert({
          where: { apexPagoId_source: { apexPagoId, source: "APEX" } },
          update: {
            description: body.description?.trim() || undefined,
            amount: body.amount ? new Prisma.Decimal(Number(body.amount).toFixed(2)) : undefined,
            paymentDate: parseDate(body.paymentDate) ?? undefined,
          },
          create: {
            source: "APEX",
            apexPagoId,
            apexPagoBaseId: body.apexPagoBaseId ? Number(body.apexPagoBaseId) : null,
            description: body.description || `Pago fijo #${apexPagoId}`,
            amount: new Prisma.Decimal((Number(body.amount) || 0).toFixed(2)),
            paymentDate: parseDate(body.paymentDate) ?? new Date(),
            company: body.company?.trim() || null,
            refType: body.refType?.trim() || null,
          },
        });
        return created(serializeSinglePayment(payment));
      }

      return badRequest(`Fuente no soportada: ${source}`);
    } catch (e) {
      return serverError("Error al crear el pago", e);
    }
  },
  "pagos.calendario",
  "edit",
);

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}