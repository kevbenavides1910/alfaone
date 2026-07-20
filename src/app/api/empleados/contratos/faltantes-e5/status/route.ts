import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  updateFaltanteE5Status,
  type FaltanteE5Estado,
} from "@/modules/empleados/services/faltantes-e5-tracking";

const ESTADOS = new Set(["PENDIENTE", "EN_PROCESO", "COMPLETADO", "NO_APLICA"]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "edit")) return forbidden();

  try {
    const body = (await req.json()) as {
      noEmple?: string;
      estado?: string;
      notas?: string;
    };
    const noEmple = body.noEmple?.trim();
    const estado = body.estado?.trim();
    if (!noEmple || !estado || !ESTADOS.has(estado)) {
      return badRequest(
        "Requiere noEmple y estado (PENDIENTE | EN_PROCESO | COMPLETADO | NO_APLICA)",
      );
    }

    const row = await updateFaltanteE5Status({
      noEmple,
      estado: estado as FaltanteE5Estado,
      notas: body.notas,
      userEmail:
        (session.user as { email?: string; name?: string } | undefined)?.email ??
        (session.user as { name?: string } | undefined)?.name ??
        undefined,
    });
    return ok(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/noEmple requerido/i.test(msg)) return badRequest(msg);
    return serverError("Error al actualizar estado", e);
  }
}
