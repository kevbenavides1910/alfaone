import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, created, notFound, ok, serverError } from "@/lib/api/response";
import { MonthlyReportError } from "@/modules/informes-mensuales/services/reports";
import {
  listIncidentEvidences,
  saveIncidentEvidence,
} from "@/modules/informes-mensuales/services/evidences";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function httpError(error: unknown, fallback: string) {
  if (error instanceof MonthlyReportError) {
    return error.code === "NOT_FOUND" ? notFound(error.message) : badRequest(error.message);
  }
  return serverError(fallback, error);
}

export const GET = withPermission(async (_req: NextRequest, ctx) => {
  try {
    return ok(await listIncidentEvidences(ctx.params.id));
  } catch (error) {
    return httpError(error, "Error al listar la evidencia");
  }
}, "informesMensuales.informes") as (req: NextRequest, ctx: Ctx) => Promise<Response>;

export const POST = withPermission(async (req: NextRequest, ctx) => {
  try {
    const userId = ctx.session.user?.id;
    const userName = ctx.session.user?.name ?? "Usuario";
    if (!userId) return badRequest("Sesión sin usuario");

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return badRequest("Archivo requerido");

    const blob = file as File;
    const saved = await saveIncidentEvidence({
      incidentId: ctx.params.id,
      userId,
      userName,
      fileName: blob.name || "evidencia",
      buffer: Buffer.from(await blob.arrayBuffer()),
    });

    return created(saved);
  } catch (error) {
    return httpError(error, "Error al subir la evidencia");
  }
}, "informesMensuales.informes", "edit") as (req: NextRequest, ctx: Ctx) => Promise<Response>;
