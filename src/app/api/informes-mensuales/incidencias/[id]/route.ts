import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, noContent, notFound, ok, serverError } from "@/lib/api/response";
import { MonthlyReportError } from "@/modules/informes-mensuales/services/reports";
import {
  deleteMonthlyIncident,
  updateMonthlyIncident,
} from "@/modules/informes-mensuales/services/incidents";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = withPermission(async (req: NextRequest, ctx) => {
  try {
    const body = (await req.json()) as { data?: unknown };
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      return badRequest("Datos de la incidencia requeridos");
    }

    const saved = await updateMonthlyIncident({
      id: ctx.params.id,
      data: body.data as Record<string, unknown>,
    });

    return ok(saved);
  } catch (error) {
    if (error instanceof MonthlyReportError) {
      return error.code === "NOT_FOUND" ? notFound(error.message) : badRequest(error.message);
    }
    return serverError("Error al actualizar la incidencia", error);
  }
}, "informesMensuales.informes", "edit") as (req: NextRequest, ctx: Ctx) => Promise<Response>;

export const DELETE = withPermission(async (_req: NextRequest, ctx) => {
  try {
    await deleteMonthlyIncident(ctx.params.id);
    return noContent();
  } catch (error) {
    if (error instanceof MonthlyReportError) {
      return error.code === "NOT_FOUND" ? notFound(error.message) : badRequest(error.message);
    }
    return serverError("Error al eliminar la incidencia", error);
  }
}, "informesMensuales.informes", "edit") as (req: NextRequest, ctx: Ctx) => Promise<Response>;
