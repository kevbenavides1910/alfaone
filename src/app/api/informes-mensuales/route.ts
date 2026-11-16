import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, created, notFound, ok, serverError } from "@/lib/api/response";
import {
  MonthlyReportError,
  listMonthlyReports,
  saveMonthlyReport,
} from "@/modules/informes-mensuales/services/reports";

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
    const period = req.nextUrl.searchParams.get("period")?.trim() || undefined;
    return ok(await listMonthlyReports(period));
  } catch (error) {
    return httpError(error, "Error al listar los informes mensuales");
  }
}, "informesMensuales.informes");

export const POST = withPermission(async (req: NextRequest, ctx) => {
  try {
    const userId = ctx.session.user?.id;
    const userName = ctx.session.user?.name ?? "Usuario";
    if (!userId) return badRequest("Sesión sin usuario");

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return badRequest("Archivo requerido");

    const blob = file as File;
    const noteRaw = form.get("note");
    const note =
      typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, 500) : null;

    const saved = await saveMonthlyReport({
      period: String(form.get("period") ?? "").trim(),
      userId,
      userName,
      fileName: blob.name || "informe.xlsx",
      declaredMime: blob.type || "application/octet-stream",
      buffer: Buffer.from(await blob.arrayBuffer()),
      note,
    });

    return created(saved);
  } catch (error) {
    return httpError(error, "Error al subir el informe mensual");
  }
}, "informesMensuales.informes", "edit");
