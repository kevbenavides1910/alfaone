import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { ok, badRequest, notFound, noContent, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";

const patchSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  latitude: z.union([z.string(), z.number()]).optional().nullable(),
  longitude: z.union([z.string(), z.number()]).optional().nullable(),
  radiusM: z.number().int().min(10).max(5000).optional(),
  windowStart: z.string().trim().max(5).optional().nullable(),
  windowEnd: z.string().trim().max(5).optional().nullable(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  positionId: z.string().trim().optional().nullable(),
});

type Params = { id: string; pointId: string };

function toDecimal(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : null;
}

function normalizePointCode(code: string): string {
  return code.trim().toUpperCase();
}

export const PATCH = withPermission<Params>(async (req: NextRequest, { params }) => {
  try {
    const existing = await prisma.patrolRoutePoint.findFirst({
      where: { id: params.pointId, routeId: params.id },
    });
    if (!existing) return notFound("Punto no encontrado");

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const data: Record<string, unknown> = {};
    if (parsed.data.code !== undefined) {
      const code = normalizePointCode(parsed.data.code);
      data.code = code;
      data.nfcTagCode = code;
    }
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.latitude !== undefined) data.latitude = toDecimal(parsed.data.latitude);
    if (parsed.data.longitude !== undefined) data.longitude = toDecimal(parsed.data.longitude);
    if (parsed.data.radiusM !== undefined) data.radiusM = parsed.data.radiusM;
    if (parsed.data.windowStart !== undefined) data.windowStart = parsed.data.windowStart?.trim() || null;
    if (parsed.data.windowEnd !== undefined) data.windowEnd = parsed.data.windowEnd?.trim() || null;
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
    if (parsed.data.positionId !== undefined) data.positionId = parsed.data.positionId?.trim() || null;

    const point = await prisma.patrolRoutePoint.update({
      where: { id: params.pointId },
      data,
    });
    return ok(point);
  } catch (e) {
    return serverError("Error al actualizar punto", e);
  }
}, "recorridos.rutas", "edit");

export const DELETE = withPermission<Params>(async (_req, { params }) => {
  try {
    const existing = await prisma.patrolRoutePoint.findFirst({
      where: { id: params.pointId, routeId: params.id },
    });
    if (!existing) return notFound("Punto no encontrado");
    await prisma.patrolRoutePoint.delete({ where: { id: params.pointId } });
    return noContent();
  } catch (e) {
    return serverError("Error al eliminar punto", e);
  }
}, "recorridos.rutas", "edit");
