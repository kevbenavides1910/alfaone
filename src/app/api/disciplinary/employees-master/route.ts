import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { canImportDisciplinary } from "@/modules/core/permissions";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { decodeUploadText } from "@/modules/core/import/text-decode";
import { importDisciplinaryEmployeeMasterCsv } from "@/modules/disciplinario/services/disciplinary-employees-csv";
import { readBoundedUpload } from "@/lib/security/form-upload";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canImportDisciplinary(session)) return forbidden();

  try {
    const form = await req.formData();
    const upload = await readBoundedUpload(form);
    if (!upload.ok) return badRequest(upload.message);

    const text = decodeUploadText(upload.buffer);
    const filename = upload.fileName;

    const result = await importDisciplinaryEmployeeMasterCsv(text, filename);
    return ok(result);
  } catch (e) {
    return serverError(
      e instanceof Error ? e.message : "Error al importar maestro de empleados",
      e,
    );
  }
}
