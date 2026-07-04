import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, created, badRequest, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import {
  addAuthorizedPhone,
  listAvailablePhonesForRoute,
} from "@/modules/syntra/services/patrol-route-phone-service";

type Params = { id: string };

const createSchema = z.object({
  assetId: z.string().trim().min(1),
  isPrimary: z.boolean().optional(),
});

export const GET = withPermission<Params>(async (_req, { params }) => {
  try {
    const available = await listAvailablePhonesForRoute(params.id);
    return ok(available);
  } catch (e) {
    return serverError("Error al listar teléfonos disponibles", e);
  }
}, "recorridos.rutas", "view");

export const POST = withPermission<Params>(async (req: NextRequest, { params }) => {
  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await addAuthorizedPhone(params.id, parsed.data.assetId, {
      isPrimary: parsed.data.isPrimary,
    });
    return created(row);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "ROUTE_NOT_FOUND") return badRequest("Ruta no encontrada");
    if (msg === "INVALID_PHONE") return badRequest("El activo seleccionado no es un celular válido");
    if (msg === "PHONE_WITHOUT_IMEI") {
      return badRequest("El celular no tiene IMEI registrado en inventario");
    }
    return serverError("Error al autorizar teléfono", e);
  }
}, "recorridos.rutas", "edit");
