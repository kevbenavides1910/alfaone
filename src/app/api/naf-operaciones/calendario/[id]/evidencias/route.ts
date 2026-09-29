import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, created } from "@/lib/api/response";
import {
  assertCanActOnEvent,
  getCalendarioEvent,
} from "@/modules/naf-operaciones/services/calendario-eventos";
import { saveCalendarioEvidence } from "@/modules/naf-operaciones/services/calendario-evidencias";
import { calendarioErrorResponse } from "@/modules/naf-operaciones/services/calendario-http";

/** POST multipart: `files` (uno o varios) y `contractId` opcional. Devuelve el evento actualizado. */
export const POST = withPermission<{ id: string }>(async (req: NextRequest, { session, params }) => {
  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Formulario inválido");
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const contractId = String(form.get("contractId") ?? "").trim() || null;
  try {
    await assertCanActOnEvent(session, params.id);
    await saveCalendarioEvidence(params.id, files, contractId, {
      id: session.user.id,
      name: session.user.name,
    });
    return created(await getCalendarioEvent(params.id));
  } catch (e) {
    return calendarioErrorResponse(e, "Error al subir la evidencia");
  }
}, "nafOperaciones.calendario", "view");
