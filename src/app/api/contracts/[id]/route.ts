import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canModifyContracts, isAdmin } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { contractUpdateSchema } from "@/modules/presupuestos/validations/contract.schema";
import { recalculateEquivalence, getTotalSuppliesBudget } from "@/modules/presupuestos/business/equivalence";
import { calcSuppliesBudget } from "@/modules/presupuestos/business/profitability";
import { getEffectiveMonthlyBilling } from "@/modules/presupuestos/business/effectiveBilling";
import { requireCompanyCode } from "@/modules/core/services/companies";
import { buildContractPrismaUpdate } from "@/modules/presupuestos/services/build-contract-prisma-update";
import { syncContractAdministrations } from "@/modules/presupuestos/services/sync-contract-administrations";
import { syncOpenFacturaEmisionesForContract } from "@/modules/presupuestos/services/facturacion-cobro";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { hasPermission } = await import("@/lib/permissions/check");
  if (!hasPermission(session, "presupuestos.contracts", "view")) return forbidden();

  const { id } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
    include: {
      periods: { orderBy: { periodNumber: "asc" } },
    },
  });

  if (!contract) return notFound("Contrato no encontrado");

  const billingHistory = await prisma.billingHistory.findMany({
    where: { contractId: id },
    select: { periodMonth: true, monthlyBilling: true },
  });

  const baseBilling = parseFloat(contract.monthlyBilling.toString());
  const suppliesPctVal = parseFloat(contract.suppliesPct.toString());
  const suppliesBudgetPctVal = parseFloat(contract.suppliesBudgetPct.toString());
  // Un solo criterio: % insumos = tarjeta Insumos; si aún no sincronizado, usar columna legacy
  const pct = suppliesPctVal > 0 ? suppliesPctVal : suppliesBudgetPctVal;
  const billing = getEffectiveMonthlyBilling(baseBilling, billingHistory, new Date());
  const suppliesBudget = calcSuppliesBudget(billing, pct);

  // Supplies share across all active contracts
  const totalSuppliesBudget = await getTotalSuppliesBudget(new Date());
  const suppliesSharePct = totalSuppliesBudget > 0 ? suppliesBudget / totalSuppliesBudget : 0;

  return ok({
    ...contract,
    baseMonthlyBilling: baseBilling,
    monthlyBilling: billing,
    suppliesBudgetPct: pct,
    equivalencePct: parseFloat(contract.equivalencePct.toString()),
    suppliesBudget,
    totalSuppliesBudget,
    suppliesSharePct,
    laborPct: parseFloat(contract.laborPct.toString()),
    suppliesPct: parseFloat(contract.suppliesPct.toString()),
    adminPct: parseFloat(contract.adminPct.toString()),
    profitPct: parseFloat(contract.profitPct.toString()),
    ivaPct: parseFloat(contract.ivaPct.toString()),
    billingDay: contract.billingDay,
    billingPeriodFromDay: contract.billingPeriodFromDay,
    billingPeriodToDay: contract.billingPeriodToDay,
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canModifyContracts(session)) return forbidden();

  const { id } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
  });
  if (!contract) return notFound();

  try {
    const body = await req.json();
    const parsed = contractUpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const { suppliesPct: sp, ...restPatch } = parsed.data;
    if (restPatch.company !== undefined) {
      const companyOk = await requireCompanyCode(prisma, restPatch.company, { mustBeActive: true });
      if (!companyOk.ok) return badRequest(companyOk.message);
    }
    const previousData = { ...contract };
    const updateData = buildContractPrismaUpdate(restPatch, sp, session.user.id);

    const updated = await prisma.contract.update({
      where: { id },
      data: updateData,
    });

    if (parsed.data.administrationsCount !== undefined) {
      await syncContractAdministrations(
        prisma,
        id,
        parsed.data.administrationsCount,
        session.user.id,
      );
      await syncOpenFacturaEmisionesForContract(prisma, id);
    }

    const data = {
      ...restPatch,
      ...(sp !== undefined ? { suppliesPct: sp, suppliesBudgetPct: sp } : {}),
    };

    // Historial de facturación: cada cambio en monthlyBilling queda vigente desde el 1º del mes en curso
    // hasta un cambio posterior (misma regla que getEffectiveMonthlyBilling / reporte anual).
    if (data.monthlyBilling !== undefined) {
      const prev = parseFloat(contract.monthlyBilling.toString());
      const next = data.monthlyBilling;
      if (Math.abs(prev - next) > 0.0001) {
        const now = new Date();
        const periodMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        await prisma.billingHistory.upsert({
          where: { contractId_periodMonth: { contractId: id, periodMonth } },
          create: {
            contractId: id,
            periodMonth,
            monthlyBilling: next,
            notes: "Actualización desde edición del contrato",
            createdById: session.user.id,
          },
          update: {
            monthlyBilling: next,
            notes: "Actualización desde edición del contrato",
            updatedAt: new Date(),
          },
        });
      }
    }

    // Recalculate global equivalence whenever anything that affects supplies budget changes
    if (
      data.positionsCount !== undefined ||
      data.monthlyBilling !== undefined ||
      sp !== undefined ||
      data.status !== undefined
    ) {
      await recalculateEquivalence();
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        contractId: contract.id,
        entityType: "Contract",
        entityId: contract.id,
        action: "UPDATE",
        previousData: JSON.stringify(previousData),
        newData: JSON.stringify(updated),
      },
    });

    return ok(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      return badRequest(
        "Faltan columnas en la base de datos (migraciones pendientes). Ejecute «npx prisma migrate deploy» en el servidor."
      );
    }
    if (e instanceof Prisma.PrismaClientValidationError) {
      return badRequest(
        "Error de validación al guardar. Reinicie el servidor de desarrollo (npm run dev:3000) y vuelva a intentar."
      );
    }
    return serverError("Error al actualizar contrato", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session)) return forbidden("Solo administradores pueden eliminar contratos");

  const { id } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
  });
  if (!contract) return notFound();

  // Soft delete
  await prisma.contract.update({
    where: { id },
    data: { deletedAt: new Date(), status: "CANCELLED" },
  });

  // Recalculate global equivalence after removal
  await recalculateEquivalence();

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      contractId: contract.id,
      entityType: "Contract",
      entityId: contract.id,
      action: "DELETE",
      previousData: JSON.stringify(contract),
    },
  });

  return ok({ message: "Contrato eliminado" });
}
