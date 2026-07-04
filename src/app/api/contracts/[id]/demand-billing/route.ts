import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canModifyContracts } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { monthsInContractRange } from "@/modules/presupuestos/business/demandBilling";
import { syncFacturasForPeriod } from "@/modules/presupuestos/services/facturacion-cobro";

type Ctx = { params: Promise<{ id: string }> };

const saveSchema = z.object({
  periodYear: z.number().int().min(2000),
  periodMonth: z.number().int().min(1).max(12),
  monthlyBilling: z.number().positive("El monto debe ser mayor a 0"),
  notes: z.string().optional(),
});

function monthInRange(
  startDate: Date,
  endDate: Date,
  periodYear: number,
  periodMonth: number
): boolean {
  return monthsInContractRange(startDate, endDate).some(
    (m) => m.periodYear === periodYear && m.periodMonth === periodMonth
  );
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const contract = await prisma.contract.findFirst({ where: { id, deletedAt: null } });
  if (!contract) return notFound();

  if (contract.hiringType !== "ON_DEMAND") {
    return badRequest("Esta pestaña aplica solo a contratos por demanda");
  }

  const slots = monthsInContractRange(contract.startDate, contract.endDate);
  const saved = await prisma.contractDemandBilling.findMany({
    where: { contractId: id },
    orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
  });

  const byKey = new Map(
    saved.map((r) => [`${r.periodYear}-${r.periodMonth}`, r] as const)
  );

  return ok({
    contractId: id,
    startDate: contract.startDate,
    endDate: contract.endDate,
    slots: slots.map(({ periodYear, periodMonth }) => {
      const row = byKey.get(`${periodYear}-${periodMonth}`);
      return {
        periodYear,
        periodMonth,
        monthlyBilling: row ? parseFloat(row.monthlyBilling.toString()) : null,
        notes: row?.notes ?? null,
        id: row?.id ?? null,
        updatedAt: row?.updatedAt.toISOString() ?? null,
      };
    }),
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canModifyContracts(session)) return forbidden();

  const { id } = await params;
  const contract = await prisma.contract.findFirst({ where: { id, deletedAt: null } });
  if (!contract) return notFound();

  if (contract.hiringType !== "ON_DEMAND") {
    return badRequest("Solo contratos por demanda admiten montos mensuales explícitos");
  }

  try {
    const body = await req.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const { periodYear, periodMonth, monthlyBilling, notes } = parsed.data;

    if (!monthInRange(contract.startDate, contract.endDate, periodYear, periodMonth)) {
      return badRequest("El mes está fuera de la vigencia del contrato");
    }

    const entry = await prisma.contractDemandBilling.upsert({
      where: {
        contractId_periodYear_periodMonth: {
          contractId: id,
          periodYear,
          periodMonth,
        },
      },
      create: {
        contractId: id,
        periodYear,
        periodMonth,
        monthlyBilling,
        notes,
        createdById: session.user.id,
      },
      update: {
        monthlyBilling,
        notes,
        updatedAt: new Date(),
      },
    });

    await syncFacturasForPeriod(prisma, periodYear, periodMonth, session.user.id);

    return created({
      ...entry,
      monthlyBilling: parseFloat(entry.monthlyBilling.toString()),
    });
  } catch (e) {
    return serverError("Error al guardar facturación por demanda", e);
  }
}
