import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canEditContractTab, canViewContractTab } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { contractAdministrationUpdateSchema } from "@/modules/presupuestos/validations/contract.schema";
import { syncOpenFacturaEmisionesForContract } from "@/modules/presupuestos/services/facturacion-cobro";

type Ctx = { params: Promise<{ id: string; adminId: string }> };

function serializeAdmin(row: {
  id: string;
  name: string;
  managerName: string;
  managerEmail: string | null;
  managerPhone: string | null;
  zoneId: string | null;
  billingPeriodFromDay: number | null;
  billingPeriodToDay: number | null;
  sortOrder: number;
  zone: { id: string; name: string } | null;
  billingLines: {
    billingLineId: string;
    monthlyAmount: { toString(): string } | null;
  }[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    managerName: row.managerName,
    managerEmail: row.managerEmail,
    managerPhone: row.managerPhone,
    zoneId: row.zoneId,
    zoneName: row.zone?.name ?? null,
    billingPeriodFromDay: row.billingPeriodFromDay,
    billingPeriodToDay: row.billingPeriodToDay,
    billingLineIds: row.billingLines.map((l) => l.billingLineId),
    billingLines: row.billingLines.map((l) => ({
      billingLineId: l.billingLineId,
      monthlyAmount: l.monthlyAmount ? parseFloat(l.monthlyAmount.toString()) : null,
    })),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function resolveBillingLinesPayload(
  data: {
    billingLineIds?: string[];
    billingLines?: { billingLineId: string; monthlyAmount?: number | null }[];
  }
): { billingLineId: string; monthlyAmount: number | null }[] | undefined {
  if (data.billingLines !== undefined) {
    return data.billingLines.map((l) => ({
      billingLineId: l.billingLineId,
      monthlyAmount: l.monthlyAmount ?? null,
    }));
  }
  if (data.billingLineIds !== undefined) {
    return data.billingLineIds.map((billingLineId) => ({
      billingLineId,
      monthlyAmount: null,
    }));
  }
  return undefined;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canEditContractTab(session, "administrations")) return forbidden();

  const { id: contractId, adminId } = await params;
  try {
    const existing = await prisma.contractAdministration.findFirst({
      where: { id: adminId, contractId },
    });
    if (!existing) return notFound();

    const body = await req.json();
    const parsed = contractAdministrationUpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    if (parsed.data.zoneId) {
      const zone = await prisma.zone.findUnique({ where: { id: parsed.data.zoneId } });
      if (!zone) return badRequest("Zona no encontrada");
    }

    const billingLinesPayload = resolveBillingLinesPayload(parsed.data);

    if (billingLinesPayload !== undefined) {
      const lineIds = billingLinesPayload.map((l) => l.billingLineId);
      const validLines = await prisma.contractBillingLine.findMany({
        where: { contractId, id: { in: lineIds } },
        select: { id: true },
      });
      if (validLines.length !== lineIds.length) {
        return badRequest("Una o más líneas de facturación no pertenecen al contrato");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.contractAdministration.update({
        where: { id: adminId },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
          ...(parsed.data.managerName !== undefined ? { managerName: parsed.data.managerName.trim() } : {}),
          ...(parsed.data.managerEmail !== undefined
            ? { managerEmail: parsed.data.managerEmail?.trim() || null }
            : {}),
          ...(parsed.data.managerPhone !== undefined
            ? { managerPhone: parsed.data.managerPhone?.trim() || null }
            : {}),
          ...(parsed.data.zoneId !== undefined ? { zoneId: parsed.data.zoneId || null } : {}),
          ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
          ...(parsed.data.billingPeriodFromDay !== undefined
            ? { billingPeriodFromDay: parsed.data.billingPeriodFromDay }
            : {}),
          ...(parsed.data.billingPeriodToDay !== undefined
            ? { billingPeriodToDay: parsed.data.billingPeriodToDay }
            : {}),
        },
      });

      if (billingLinesPayload !== undefined) {
        await tx.contractAdministrationBillingLine.deleteMany({
          where: { administrationId: adminId },
        });
        if (billingLinesPayload.length > 0) {
          await tx.contractAdministrationBillingLine.createMany({
            data: billingLinesPayload.map((line) => ({
              administrationId: adminId,
              billingLineId: line.billingLineId,
              monthlyAmount: line.monthlyAmount,
            })),
          });
        }
      }
    });

    const updated = await prisma.contractAdministration.findUniqueOrThrow({
      where: { id: adminId },
      include: {
        zone: { select: { id: true, name: true } },
        billingLines: { select: { billingLineId: true, monthlyAmount: true } },
      },
    });

    await syncOpenFacturaEmisionesForContract(prisma, contractId);

    return ok(serializeAdmin(updated));
  } catch (e) {
    return serverError("Error al actualizar administración", e);
  }
}
