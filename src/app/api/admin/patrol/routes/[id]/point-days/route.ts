import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, badRequest, notFound, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import {
  getRoutePointDays,
  saveRoutePointDays,
} from "@/modules/syntra/services/patrol-route-point-days-service";

const putSchema = z.object({
  samePointsEveryDay: z.boolean(),
  assignments: z.array(
    z.object({
      pointId: z.string().trim().min(1),
      dayOfWeek: z.number().int().min(0).max(6),
    }),
  ),
});

type Params = { id: string };

export const GET = withPermission<Params>(async (_req, { params }) => {
  try {
    const data = await getRoutePointDays(params.id);
    if (!data) return notFound("Ruta no encontrada");
    return ok(data);
  } catch (e) {
    return serverError("Error al cargar puntos por día", e);
  }
}, "recorridos.rutas", "view");

export const PUT = withPermission<Params>(async (req: NextRequest, { params }) => {
  try {
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const data = await saveRoutePointDays(
      params.id,
      parsed.data.samePointsEveryDay,
      parsed.data.assignments,
    );
    if (!data) return notFound("Ruta no encontrada");
    return ok(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "ROUTE_NOT_FOUND") return notFound("Ruta no encontrada");
    return serverError("Error al guardar puntos por día", e);
  }
}, "recorridos.rutas", "edit");
