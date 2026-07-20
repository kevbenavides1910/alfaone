import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { OpWriteNotAvailableError, nextNoRol } from "@/modules/naf-operaciones/services/op-write";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "nafOperaciones.programacion", "edit")) return forbidden();

  try {
    const noRol = await nextNoRol();
    return ok({ noRol });
  } catch (e) {
    if (e instanceof OpWriteNotAvailableError) return badRequest(e.message);
    return serverError("Error al sugerir NO_ROL", e);
  }
}
