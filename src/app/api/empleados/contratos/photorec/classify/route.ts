import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  classifyPhotorecItem,
  type PhotorecTipo,
} from "@/modules/empleados/services/photorec-review";

const TIPOS = new Set([
  "E5",
  "E20",
  "E28",
  "E59",
  "E22",
  "E79",
  "E7",
  "OTRO",
  "BASURA",
  "PENDIENTE",
]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "edit")) return forbidden();

  try {
    const body = (await req.json()) as {
      id?: string;
      tipo?: string;
      noEmple?: string;
      cedula?: string;
      nombre?: string;
      notas?: string;
    };
    const id = body.id?.trim();
    const tipo = body.tipo?.trim();
    if (!id || !tipo || !TIPOS.has(tipo)) {
      return badRequest("Requiere id y tipo válido");
    }

    const row = await classifyPhotorecItem({
      id,
      tipo: tipo as PhotorecTipo,
      noEmple: body.noEmple,
      cedula: body.cedula,
      nombre: body.nombre,
      notas: body.notas,
      userEmail: (session.user as { email?: string; name?: string } | undefined)?.email
        ?? (session.user as { name?: string } | undefined)?.name
        ?? undefined,
    });
    return ok(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/ID inválido|no such file|ENOENT/i.test(msg)) {
      return badRequest(msg);
    }
    return serverError("Error al clasificar PDF", e);
  }
}
