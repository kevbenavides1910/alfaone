import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, notFound, badRequest, serverError } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { prisma } from "@/modules/core/db/prisma";
import { fromMonthString } from "@/lib/utils/format";
import {
  getContractRubroSpendBreakdown,
  type RubroSpendKey,
} from "@/modules/presupuestos/business/rubro-spend-breakdown";

type Ctx = { params: Promise<{ id: string }> };

const RUBROS = new Set<RubroSpendKey>(["LABOR", "SUPPLIES", "ADMIN", "PROFIT"]);

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "gastos.reports_monthly", "view")) return unauthorized();

  const { id } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, licitacionNo: true, client: true, company: true },
  });
  if (!contract) return notFound();

  const monthStr = req.nextUrl.searchParams.get("month");
  const rubroRaw = req.nextUrl.searchParams.get("rubro")?.toUpperCase();
  if (!monthStr) return badRequest("Parámetro month requerido (yyyy-MM)");
  if (!rubroRaw || !RUBROS.has(rubroRaw as RubroSpendKey)) {
    return badRequest("Parámetro rubro inválido (LABOR, SUPPLIES, ADMIN, PROFIT)");
  }

  const periodMonth = fromMonthString(monthStr);
  if (Number.isNaN(periodMonth.getTime())) return badRequest("Mes inválido");

  try {
    const breakdown = await getContractRubroSpendBreakdown(
      id,
      periodMonth,
      rubroRaw as RubroSpendKey,
    );
    return ok({
      contractId: contract.id,
      licitacionNo: contract.licitacionNo,
      client: contract.client,
      company: contract.company,
      month: monthStr,
      ...breakdown,
    });
  } catch (e) {
    return serverError("Error al cargar desglose de gasto", e);
  }
}
