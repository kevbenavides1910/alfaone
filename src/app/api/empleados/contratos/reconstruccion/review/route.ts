import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  reviewReconstruccionItem,
  type ReconstruccionEstado,
} from "@/modules/empleados/services/reconstruccion-e5-review";

const ESTADOS = new Set(["APROBADO", "OBSERVADO"]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "edit")) return forbidden();

  try {
    const body = (await req.json()) as {
      id?: string;
      estado?: string;
      observacion?: string;
    };
    const id = body.id?.trim();
    const estado = body.estado?.trim();
    if (!id || !estado || !ESTADOS.has(estado)) {
      return badRequest("Requiere id y estado válido (APROBADO | OBSERVADO)");
    }

    const row = await reviewReconstruccionItem({
      id,
      estado: estado as ReconstruccionEstado,
      observacion: body.observacion,
      userEmail:
        (session.user as { email?: string; name?: string } | undefined)?.email ??
        (session.user as { name?: string } | undefined)?.name ??
        undefined,
    });
    return ok(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ID inválido|observación es requerida|no such file|ENOENT/i.test(msg)) {
      return badRequest(msg);
    }
    return serverError("Error al guardar revisión", e);
  }
}
