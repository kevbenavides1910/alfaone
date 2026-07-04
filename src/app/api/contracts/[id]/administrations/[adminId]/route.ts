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
  billingLines: { billingLineId: string }[];
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
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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

    if (parsed.data.billingLineIds !== undefined) {
      const validLines = await prisma.contractBillingLine.findMany({
        where: { contractId, id: { in: parsed.data.billingLineIds } },
        select: { id: true },
      });
      if (validLines.length !== parsed.data.billingLineIds.length) {
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

      if (parsed.data.billingLineIds !== undefined) {
        await tx.contractAdministrationBillingLine.deleteMany({
          where: { administrationId: adminId },
        });
        if (parsed.data.billingLineIds.length > 0) {
          await tx.contractAdministrationBillingLine.createMany({
            data: parsed.data.billingLineIds.map((billingLineId) => ({
              administrationId: adminId,
              billingLineId,
            })),
          });
        }
      }
    });

    const updated = await prisma.contractAdministration.findUniqueOrThrow({
      where: { id: adminId },
      include: {
        zone: { select: { id: true, name: true } },
        billingLines: { select: { billingLineId: true } },
      },
    });

    await syncOpenFacturaEmisionesForContract(prisma, contractId);

    return ok(serializeAdmin(updated));
  } catch (e) {
    return serverError("Error al actualizar administración", e);
  }
}
