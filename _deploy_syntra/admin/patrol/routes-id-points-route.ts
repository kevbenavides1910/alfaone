import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { ok, created, badRequest, notFound, noContent, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";

const pointSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  nfcTagCode: z.string().trim().max(80).optional().nullable(),
  latitude: z.union([z.string(), z.number()]).optional().nullable(),
  longitude: z.union([z.string(), z.number()]).optional().nullable(),
  radiusM: z.number().int().min(10).max(5000).optional(),
  windowStart: z.string().trim().max(5).optional().nullable(),
  windowEnd: z.string().trim().max(5).optional().nullable(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  positionId: z.string().trim().optional().nullable(),
});

type Params = { id: string };

function toDecimal(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : null;
}

export const GET = withPermission<Params>(async (_req, { params }) => {
  try {
    const route = await prisma.patrolRoute.findUnique({ where: { id: params.id } });
    if (!route) return notFound("Ruta no encontrada");
    const points = await prisma.patrolRoutePoint.findMany({
      where: { routeId: params.id },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    return ok(points);
  } catch (e) {
    return serverError("Error al listar puntos", e);
  }
}, "recorridos.rutas", "view");

export const POST = withPermission<Params>(async (req: NextRequest, { params }) => {
  try {
    const route = await prisma.patrolRoute.findUnique({ where: { id: params.id } });
    if (!route) return notFound("Ruta no encontrada");

    const parsed = pointSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const maxOrder = await prisma.patrolRoutePoint.aggregate({
      where: { routeId: params.id },
      _max: { sortOrder: true },
    });

    const point = await prisma.patrolRoutePoint.create({
      data: {
        routeId: params.id,
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        nfcTagCode: parsed.data.nfcTagCode?.trim() || null,
        latitude: toDecimal(parsed.data.latitude),
        longitude: toDecimal(parsed.data.longitude),
        radiusM: parsed.data.radiusM ?? 100,
        windowStart: parsed.data.windowStart?.trim() || null,
        windowEnd: parsed.data.windowEnd?.trim() || null,
        sortOrder: parsed.data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
        positionId: parsed.data.positionId?.trim() || null,
      },
    });
    return created(point);
  } catch (e) {
    return serverError("Error al crear punto", e);
  }
}, "recorridos.rutas", "edit");
