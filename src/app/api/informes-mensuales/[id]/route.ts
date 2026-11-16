import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, noContent, notFound, serverError } from "@/lib/api/response";
import {
  MonthlyReportError,
  deleteMonthlyReport,
} from "@/modules/informes-mensuales/services/reports";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = withPermission(async (_req: NextRequest, ctx) => {
  try {
    await deleteMonthlyReport(ctx.params.id);
    return noContent();
  } catch (error) {
    if (error instanceof MonthlyReportError) {
      return error.code === "NOT_FOUND" ? notFound(error.message) : badRequest(error.message);
    }
    return serverError("Error al eliminar el informe mensual", error);
  }
}, "informesMensuales.informes", "edit") as (req: NextRequest, ctx: Ctx) => Promise<Response>;
