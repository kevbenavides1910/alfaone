import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, notFound, serverError, noContent } from "@/lib/api/response";
import {
  deleteFingerShift,
  getFingerShift,
  updateFingerShift,
} from "@/modules/finger-system/services/finger-shifts";

export const GET = withPermission(
  async (_req: NextRequest, { params }) => {
    try {
      const row = await getFingerShift(params.id);
      if (!row) return notFound("Turno no encontrado.");
      return ok(row);
    } catch (e) {
      return serverError("Error al consultar turno.", e);
    }
  },
  "fingerSystem.turnos",
  "view",
);

export const PATCH = withPermission(
  async (req: NextRequest, { params }) => {
    try {
      const body = await req.json().catch(() => ({}));
      return ok(await updateFingerShift(params.id, body));
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible actualizar el turno.", e);
    }
  },
  "fingerSystem.turnos",
  "edit",
);

export const DELETE = withPermission(
  async (_req: NextRequest, { params }) => {
    try {
      await deleteFingerShift(params.id);
      return noContent();
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible eliminar el turno.", e);
    }
  },
  "fingerSystem.turnos",
  "edit",
);
