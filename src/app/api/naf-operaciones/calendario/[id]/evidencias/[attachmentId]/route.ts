import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { notFound, ok, serverError } from "@/lib/api/response";
import {
  assertCanActOnEvent,
  getCalendarioEvent,
} from "@/modules/naf-operaciones/services/calendario-eventos";
import {
  deleteCalendarioEvidence,
  readCalendarioEvidence,
} from "@/modules/naf-operaciones/services/calendario-evidencias";
import { calendarioErrorResponse } from "@/modules/naf-operaciones/services/calendario-http";

type Params = { id: string; attachmentId: string };

const INLINE_PREFIXES = ["image/", "application/pdf", "video/"];

/** GET ?download=1 fuerza descarga; por defecto imágenes/PDF/video se abren en el navegador. */
export const GET = withPermission<Params>(async (req: NextRequest, { params }) => {
  try {
    const file = await readCalendarioEvidence(params.id, params.attachmentId);
    if (!file) return notFound("Evidencia no encontrada");
    const inline =
      req.nextUrl.searchParams.get("download") !== "1" &&
      INLINE_PREFIXES.some((p) => file.mimeType.startsWith(p));
    return new Response(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return serverError("Error al descargar la evidencia", e);
  }
}, "nafOperaciones.calendario", "view");

export const DELETE = withPermission<Params>(async (_req, { session, params }) => {
  try {
    await assertCanActOnEvent(session, params.id);
    await deleteCalendarioEvidence(params.id, params.attachmentId);
    return ok(await getCalendarioEvent(params.id));
  } catch (e) {
    return calendarioErrorResponse(e, "Error al eliminar la evidencia");
  }
}, "nafOperaciones.calendario", "view");
