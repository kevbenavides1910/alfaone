import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { notFound, serverError } from "@/lib/api/response";
import {
  MonthlyReportError,
  getMonthlyReportFile,
} from "@/modules/informes-mensuales/services/reports";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withPermission(async (_req: NextRequest, ctx) => {
  try {
    const { row, abs } = await getMonthlyReportFile(ctx.params.id);
    const buffer = await readFile(abs).catch(() => null);
    if (!buffer) return notFound("El informe ya no está disponible");

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
    if (error instanceof MonthlyReportError) return notFound(error.message);
    return serverError("Error al descargar el informe mensual", error);
  }
}, "informesMensuales.informes") as (req: NextRequest, ctx: Ctx) => Promise<Response>;
