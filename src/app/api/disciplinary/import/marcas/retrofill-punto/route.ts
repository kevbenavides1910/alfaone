import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { canImportDisciplinary } from "@/modules/core/permissions";
import { unauthorized, forbidden, badRequest, created, serverError } from "@/lib/api/response";
import { retrofillPuntoOmitidoFromMarcasWorkbook } from "@/modules/disciplinario/services/disciplinary-marcas-import";
import { readBoundedUpload } from "@/lib/security/form-upload";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canImportDisciplinary(session)) return forbidden();

  try {
    const form = await req.formData();
    const batchIdRaw = form.get("batchId");
    const batchId = typeof batchIdRaw === "string" ? batchIdRaw.trim() : "";
    if (!batchId) {
      return badRequest("Indique batchId del lote de marcas a actualizar");
    }
    const upload = await readBoundedUpload(form);
    if (!upload.ok) return badRequest(upload.message);

    const data = await retrofillPuntoOmitidoFromMarcasWorkbook(upload.buffer, batchId);
    return created(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al retroactualizar puntos";
    if (
      msg.includes("Lote no encontrado") ||
      msg.includes("Solo aplica") ||
      msg.includes("import_marcas")
    ) {
      return badRequest(msg);
    }
    return serverError(msg, e);
  }
}
