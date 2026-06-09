import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, badRequest, notFound, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import {
  getRouteSchedules,
  replaceRouteSchedules,
  type RouteScheduleSlot,
} from "@/modules/syntra/services/patrol-route-schedule-service";
import { prisma } from "@/modules/core/db/prisma";

type Params = { id: string };

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().trim().min(4).max(5),
  endTime: z.string().trim().min(4).max(5),
  sortOrder: z.number().int().min(0).optional(),
});

const putSchema = z.object({
  openSchedule: z.boolean(),
  slots: z.array(slotSchema).default([]),
});

export const GET = withPermission<Params>(async (_req, { params }) => {
  try {
    const route = await prisma.patrolRoute.findUnique({
      where: { id: params.id },
      select: { id: true, openSchedule: true },
    });
    if (!route) return notFound("Ruta no encontrada");
    const slots = await getRouteSchedules(params.id);
    return ok({ openSchedule: route.openSchedule, slots });
  } catch (e) {
    return serverError("Error al cargar horarios", e);
  }
}, "recorridos.rutas", "view");

export const PUT = withPermission<Params>(async (req: NextRequest, { params }) => {
  try {
    const route = await prisma.patrolRoute.findUnique({ where: { id: params.id } });
    if (!route) return notFound("Ruta no encontrada");

    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    try {
      await replaceRouteSchedules(
        params.id,
        parsed.data.openSchedule,
        parsed.data.slots as RouteScheduleSlot[],
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "INVALID_TIME") return badRequest("Formato de hora inválido (use HH:MM)");
      if (msg === "INVALID_DAY") return badRequest("Día de la semana inválido");
      throw e;
    }

    const slots = await getRouteSchedules(params.id);
    return ok({ openSchedule: parsed.data.openSchedule, slots });
  } catch (e) {
    return serverError("Error al guardar horarios", e);
  }
}, "recorridos.rutas", "edit");
