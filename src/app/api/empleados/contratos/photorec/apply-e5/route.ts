import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { applyPhotorecAsE5 } from "@/modules/empleados/services/photorec-review";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "edit")) return forbidden();

  try {
    const body = (await req.json()) as {
      id?: string;
      noEmple?: string;
      cedula?: string;
      nombre?: string;
      notas?: string;
    };
    const id = body.id?.trim();
    const noEmple = body.noEmple?.trim();
    if (!id || !noEmple) {
      return badRequest("Requiere id (PDF) y noEmple");
    }

    const actor =
      (session.user as { email?: string; name?: string } | undefined)?.email ??
      (session.user as { name?: string } | undefined)?.name ??
      undefined;

    const result = await applyPhotorecAsE5({
      id,
      noEmple,
      cedula: body.cedula,
      nombre: body.nombre,
      notas: body.notas,
      userEmail: actor,
    });

    if (result.status === "error") {
      return badRequest(result.message);
    }

    return ok(result);
  } catch (e) {
    return serverError("Error al aplicar PDF como E5", e);
  }
}
