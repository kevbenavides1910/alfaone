import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { saveMonitoreoImage } from "@/modules/monitoreo/services/imagenes";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "monitoreo.operacion", "edit")) return forbidden();

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("Archivo requerido (campo file)");

    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveMonitoreoImage({
      buffer,
      mimeType: file.type || "image/jpeg",
      originalName: file.name,
    });
    return created(saved);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al subir imagen";
    return badRequest(msg);
  }
}
