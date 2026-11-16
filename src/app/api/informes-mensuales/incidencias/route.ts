import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, created, notFound, ok, serverError } from "@/lib/api/response";
import { MonthlyReportError } from "@/modules/informes-mensuales/services/reports";
import {
  createMonthlyIncident,
  listMonthlyIncidents,
} from "@/modules/informes-mensuales/services/incidents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function httpError(error: unknown, fallback: string) {
  if (error instanceof MonthlyReportError) {
    return error.code === "NOT_FOUND" ? notFound(error.message) : badRequest(error.message);
  }
  return serverError(fallback, error);
}

export const GET = withPermission(async (req: NextRequest) => {
  try {
    const source = req.nextUrl.searchParams.get("source")?.trim() || "base";
    return ok(await listMonthlyIncidents(source));
  } catch (error) {
    return httpError(error, "Error al listar las incidencias");
  }
}, "informesMensuales.informes");

export const POST = withPermission(async (req: NextRequest, ctx) => {
  try {
    const userId = ctx.session.user?.id;
    const userName = ctx.session.user?.name ?? "Usuario";
    if (!userId) return badRequest("Sesión sin usuario");

    const body = (await req.json()) as { source?: unknown; data?: unknown };
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      return badRequest("Datos de la incidencia requeridos");
    }

    const saved = await createMonthlyIncident({
      source: typeof body.source === "string" ? body.source : "base",
      data: body.data as Record<string, unknown>,
      userId,
      userName,
    });

    return created(saved);
  } catch (error) {
    return httpError(error, "Error al guardar la incidencia");
  }
}, "informesMensuales.informes", "edit");
