import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, badRequest, notFound, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import {
  getRoutePointDays,
  groupPointDaysByWeekday,
  replaceRoutePointDays,
  type RoutePointDayAssignment,
} from "@/modules/syntra/services/patrol-route-point-day-service";
import { prisma } from "@/modules/core/db/prisma";

type Params = { id: string };

const daySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  pointIds: z.array(z.string().trim().min(1)).default([]),
});

const putSchema = z.object({
  samePointsEveryDay: z.boolean(),
  days: z.array(daySchema).default([]),
});

export const GET = withPermission<Params>(async (_req, { params }) => {
  try {
    const route = await prisma.patrolRoute.findUnique({
      where: { id: params.id },
      select: { id: true, samePointsEveryDay: true },
    });
    if (!route) return notFound("Ruta no encontrada");

    const rows = await getRoutePointDays(params.id);
    return ok({
      samePointsEveryDay: route.samePointsEveryDay,
      days: groupPointDaysByWeekday(rows),
    });
  } catch (e) {
    return serverError("Error al cargar puntos por día", e);
  }
}, "recorridos.rutas", "view");

export const PUT = withPermission<Params>(async (req: NextRequest, { params }) => {
  try {
    const route = await prisma.patrolRoute.findUnique({ where: { id: params.id } });
    if (!route) return notFound("Ruta no encontrada");

    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    try {
      await replaceRoutePointDays(
        params.id,
        parsed.data.samePointsEveryDay,
        parsed.data.days as RoutePointDayAssignment[],
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "INVALID_DAY") return badRequest("Día de la semana inválido");
      if (msg === "INVALID_POINT") return badRequest("Punto no pertenece a esta ruta");
      throw e;
    }

    const rows = await getRoutePointDays(params.id);
    return ok({
      samePointsEveryDay: parsed.data.samePointsEveryDay,
      days: groupPointDaysByWeekday(rows),
    });
  } catch (e) {
    return serverError("Error al guardar puntos por día", e);
  }
}, "recorridos.rutas", "edit");
