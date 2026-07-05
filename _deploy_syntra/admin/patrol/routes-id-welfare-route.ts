import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { ok, badRequest, notFound, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import {
  triggerManualWelfareCheck,
  updateRouteWelfareConfig,
} from "@/modules/syntra/services/patrol-welfare-service";

const patchSchema = z.object({
  welfareEnabled: z.boolean(),
  welfareIntervalMinutes: z.number().int().min(5).max(480),
});

type Params = { id: string };

export const PATCH = withPermission<Params>(async (req: NextRequest, { params }) => {
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const existing = await prisma.patrolRoute.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Ruta no encontrada");

    const updated = await updateRouteWelfareConfig(
      params.id,
      parsed.data.welfareEnabled,
      parsed.data.welfareIntervalMinutes,
    );
    return ok(updated);
  } catch (e) {
    return serverError("Error al guardar hombre vivo", e);
  }
}, "recorridos.rutas", "edit");

export const POST = withPermission<Params>(async (_req, { params }) => {
  try {
    const existing = await prisma.patrolRoute.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Ruta no encontrada");

    const result = await triggerManualWelfareCheck(params.id);
    return ok({
      message: `Alerta enviada a ${result.createdCount} dispositivo(s)`,
      createdCount: result.createdCount,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "ROUTE_NOT_FOUND") return notFound("Ruta no encontrada");
    if (msg === "ROUTE_INACTIVE") return badRequest("La ruta está inactiva");
    if (msg === "NO_PHONES") {
      return badRequest("No hay celulares autorizados en esta ruta");
    }
    return serverError("Error al disparar alerta", e);
  }
}, "recorridos.rutas", "edit");
