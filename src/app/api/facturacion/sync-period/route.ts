import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { syncFacturasForPeriod } from "@/modules/presupuestos/services/facturacion-cobro";
import { facturacionPeriodSchema } from "@/modules/presupuestos/validations/facturacion.schema";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "view")) return forbidden();

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const now = new Date();
  const parsed = facturacionPeriodSchema.safeParse({
    periodMonth:
      typeof body === "object" && body !== null && "periodMonth" in body
        ? (body as { periodMonth?: unknown }).periodMonth
        : now.getMonth() + 1,
    periodYear:
      typeof body === "object" && body !== null && "periodYear" in body
        ? (body as { periodYear?: unknown }).periodYear
        : now.getFullYear(),
  });
  if (!parsed.success) return badRequest("Parámetros inválidos", parsed.error.flatten());

  try {
    await syncFacturasForPeriod(
      prisma,
      parsed.data.periodYear,
      parsed.data.periodMonth,
      session.user.id
    );
    return ok({
      periodMonth: parsed.data.periodMonth,
      periodYear: parsed.data.periodYear,
      synced: true,
    });
  } catch (e) {
    return serverError("Error al sincronizar facturación del periodo", e);
  }
}
