import { NextRequest } from "next/server";
import { ok, badRequest, noContent, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import {
  removeAuthorizedPhone,
  setPrimaryPhone,
} from "@/modules/syntra/services/patrol-route-phone-service";

type Params = { id: string; phoneId: string };

export const PATCH = withPermission<Params>(async (_req: NextRequest, { params }) => {
  try {
    await setPrimaryPhone(params.id, params.phoneId);
    return ok({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "PHONE_NOT_FOUND") return badRequest("Teléfono no encontrado en esta ruta");
    return serverError("Error al establecer celular principal", e);
  }
}, "recorridos.rutas", "edit");

export const DELETE = withPermission<Params>(async (_req, { params }) => {
  try {
    await removeAuthorizedPhone(params.id, params.phoneId);
    return noContent();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "PHONE_NOT_FOUND") return badRequest("Teléfono no encontrado en esta ruta");
    if (msg === "CANNOT_REMOVE_PRIMARY") {
      return badRequest("No puede quitar el celular principal. Asigne otro como principal primero.");
    }
    return serverError("Error al quitar teléfono autorizado", e);
  }
}, "recorridos.rutas", "edit");
