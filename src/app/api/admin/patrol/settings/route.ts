import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { ensureSyntraSettingsRow } from "@/modules/syntra/services/patrol-admin-service";

const patchSchema = z.object({
  enableGeofences: z.boolean().optional(),
  enableGpsTrack: z.boolean().optional(),
  geofenceRadiusM: z.number().int().min(10).max(5000).optional(),
  routesSyncMinutes: z.number().int().min(5).max(1440).optional(),
  reportsSyncMinutes: z.number().int().min(5).max(1440).optional(),
});

export const GET = withPermission(async () => {
  try {
    const row = await ensureSyntraSettingsRow();
    return ok({ ...row, enableGpsTrack: true });
  } catch (e) {
    return serverError("Error al cargar configuración SYNTRA", e);
  }
}, "recorridos.configuracion", "view");

export const PATCH = withPermission(async (req: NextRequest) => {
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    await ensureSyntraSettingsRow();
    const row = await prisma.appSyntraSettings.update({
      where: { id: "default" },
      data: { ...parsed.data, enableGpsTrack: true },
    });
    return ok({ ...row, enableGpsTrack: true });
  } catch (e) {
    return serverError("Error al guardar configuración SYNTRA", e);
  }
}, "recorridos.configuracion", "edit");
