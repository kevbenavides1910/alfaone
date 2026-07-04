import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { readBoundedUpload } from "@/lib/security/form-upload";
import { importEmployeesCsv } from "@/modules/empleados/services/employees-csv-import";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.import", "edit")) return forbidden();

  try {
    const form = await req.formData();
    const upload = await readBoundedUpload(form);
    if (!upload.ok) return badRequest(upload.message);

    const text = new TextDecoder("utf-8").decode(upload.buffer);
    const result = await importEmployeesCsv(text, upload.fileName, session.user.id);
    return ok(result);
  } catch (e) {
    return serverError(
      e instanceof Error ? e.message : "Error al importar empleados",
      e,
    );
  }
}
