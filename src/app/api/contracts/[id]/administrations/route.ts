import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canEditContractTab, canViewContractTab } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { syncContractAdministrations } from "@/modules/presupuestos/services/sync-contract-administrations";

type Ctx = { params: Promise<{ id: string }> };

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

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canViewContractTab(session, "administrations")) return forbidden();

  const { id: contractId } = await params;
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
      select: { id: true, administrationsCount: true },
    });
    if (!contract) return notFound();

    await syncContractAdministrations(prisma, contractId, contract.administrationsCount);

    const rows = await prisma.contractAdministration.findMany({
      where: { contractId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        zone: { select: { id: true, name: true } },
        billingLines: { select: { billingLineId: true } },
      },
    });

    return ok({
      administrationsCount: contract.administrationsCount,
      administrations: rows.map(serializeAdmin),
    });
  } catch (e) {
    return serverError("Error al obtener administraciones", e);
  }
}
