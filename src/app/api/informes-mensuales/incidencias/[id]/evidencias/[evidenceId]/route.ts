import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, noContent, notFound, serverError } from "@/lib/api/response";
import { MonthlyReportError } from "@/modules/informes-mensuales/services/reports";
import {
  deleteIncidentEvidence,
  getIncidentEvidenceFile,
} from "@/modules/informes-mensuales/services/evidences";

type Ctx = { params: Promise<{ id: string; evidenceId: string }> };

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
    const { row, absolutePath } = await getIncidentEvidenceFile(
      ctx.params.id,
      ctx.params.evidenceId,
    );
    const buffer = await readFile(absolutePath).catch(() => null);
    if (!buffer) return notFound("La evidencia ya no está disponible");

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": row.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(row.fileName)}"`,
        "Content-Length": String(buffer.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    return httpError(error, "Error al descargar la evidencia");
  }
}, "informesMensuales.informes") as (req: NextRequest, ctx: Ctx) => Promise<Response>;

export const DELETE = withPermission(async (_req: NextRequest, ctx) => {
  try {
    await deleteIncidentEvidence(ctx.params.id, ctx.params.evidenceId);
    return noContent();
  } catch (error) {
    return httpError(error, "Error al eliminar la evidencia");
  }
}, "informesMensuales.informes", "edit") as (req: NextRequest, ctx: Ctx) => Promise<Response>;
