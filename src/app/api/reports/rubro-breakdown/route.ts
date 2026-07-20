import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, badRequest, serverError } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { fromMonthString } from "@/lib/utils/format";
import {
  getConsolidatedRubroSpendBreakdown,
  type RubroSpendKey,
} from "@/modules/presupuestos/business/rubro-spend-breakdown";

const RUBROS = new Set<RubroSpendKey>(["LABOR", "SUPPLIES", "ADMIN", "PROFIT"]);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "gastos.reports_monthly", "view")) return unauthorized();

  const { searchParams } = new URL(req.url);
  const monthStr = searchParams.get("month");
  const rubroRaw = searchParams.get("rubro")?.toUpperCase();
  const contractIds = searchParams.getAll("contractId").map((id) => id.trim()).filter(Boolean);

  if (!monthStr) return badRequest("Parámetro month requerido (yyyy-MM)");
  if (!rubroRaw || !RUBROS.has(rubroRaw as RubroSpendKey)) {
    return badRequest("Parámetro rubro inválido (LABOR, SUPPLIES, ADMIN, PROFIT)");
  }
  if (contractIds.length === 0) {
    return badRequest("Al menos un contractId es requerido");
  }

  const periodMonth = fromMonthString(monthStr);
  if (Number.isNaN(periodMonth.getTime())) return badRequest("Mes inválido");

  try {
    const breakdown = await getConsolidatedRubroSpendBreakdown(
      contractIds,
      periodMonth,
      rubroRaw as RubroSpendKey,
    );
    return ok({
      consolidated: true,
      month: monthStr,
      ...breakdown,
    });
  } catch (e) {
    return serverError("Error al cargar desglose consolidado de gasto", e);
  }
}
