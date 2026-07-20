import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { unauthorized, forbidden, notFound } from "@/lib/api/response";
import { readMonitoreoImage } from "@/modules/monitoreo/services/imagenes";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ fileName: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (
    !requirePermission(session, "monitoreo.operacion", "view") &&
    !requirePermission(session, "monitoreo.registros", "view")
  ) {
    return forbidden();
  }

  const { fileName } = await ctx.params;
  const decoded = decodeURIComponent(fileName);
  const file = await readMonitoreoImage(decoded);
  if (!file) return notFound("Imagen no encontrada");

  return new Response(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
