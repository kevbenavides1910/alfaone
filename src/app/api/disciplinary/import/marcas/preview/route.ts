import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { canImportDisciplinary } from "@/modules/core/permissions";
import { unauthorized, forbidden, badRequest, ok, serverError } from "@/lib/api/response";
import { previewDisciplinaryMarcasWorkbook } from "@/modules/disciplinario/services/disciplinary-marcas-import";
import { readBoundedUpload } from "@/lib/security/form-upload";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canImportDisciplinary(session)) return forbidden();

  try {
    const form = await req.formData();
    const upload = await readBoundedUpload(form);
    if (!upload.ok) return badRequest(upload.message);
    const data = await previewDisciplinaryMarcasWorkbook(upload.buffer);
    return ok(data);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Error al analizar marcas", e);
  }
}
