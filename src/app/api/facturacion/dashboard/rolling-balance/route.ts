import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { buildCxcRollingBalance } from "@/modules/presupuestos/services/facturacion-dashboard";
import { facturacionDashboardSchema } from "@/modules/presupuestos/validations/facturacion-dashboard.schema";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.dashboard", "view")) return forbidden();
  if (!hasPermission(session, "facturacion.cxc", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const parsed = facturacionDashboardSchema.safeParse({
    year: searchParams.get("year") ?? String(now.getFullYear()),
  });
  if (!parsed.success) return badRequest("Parámetros inválidos", parsed.error.flatten());

  try {
    const cxcRollingBalance = await buildCxcRollingBalance(prisma, parsed.data.year);
    return ok({ year: parsed.data.year, cxcRollingBalance });
  } catch (e) {
    return serverError("Error al cargar balance CxC", e);
  }
}
