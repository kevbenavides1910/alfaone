import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { getExecutiveBusinessInsights } from "@/modules/presupuestos/services/executive-insights";

/**
 * GET /api/dashboard/executive?month=YYYY-MM
 * Paneles críticos (facturación/CxC, pagos, tickets, disciplinario) según permisos.
 */
export const GET = withPermission(async (req: NextRequest, { session }) => {
  const monthParam = req.nextUrl.searchParams.get("month");
  const now = new Date();
  const month =
    monthParam?.trim() ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return badRequest("Parámetro month inválido (use YYYY-MM)");
  }

  try {
    const data = await getExecutiveBusinessInsights(session, month);
    return ok(data);
  } catch (e) {
    return serverError("Error al cargar paneles ejecutivos", e);
  }
}, "core.dashboard_ejecutivo", "view");
