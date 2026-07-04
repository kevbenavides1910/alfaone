import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { ok, badRequest, notFound, noContent, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import {
  getRoutePhones,
  validateRouteAssignment,
} from "@/modules/syntra/services/patrol-route-phone-service";

const patchSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  contractId: z.string().trim().optional().nullable(),
  locationId: z.string().trim().optional().nullable(),
  positionId: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

type Params = { id: string };

export const GET = withPermission<Params>(async (_req, { params }) => {
  try {
    const route = await prisma.patrolRoute.findUnique({
      where: { id: params.id },
      include: {
        contract: { select: { id: true, licitacionNo: true, client: true } },
        location: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
        points: { orderBy: [{ sortOrder: "asc" }, { code: "asc" }] },
        schedules: { orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }] },
      },
    });
    if (!route) return notFound("Ruta no encontrada");

    const phones = await getRoutePhones(params.id);
    return ok({ ...route, phones });
  } catch (e) {
    return serverError("Error al cargar ruta", e);
  }
}, "recorridos.rutas", "view");

export const PATCH = withPermission<Params>(async (req: NextRequest, { params }) => {
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const existing = await prisma.patrolRoute.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Ruta no encontrada");

    const nextContractId =
      parsed.data.contractId !== undefined
        ? parsed.data.contractId?.trim() || null
        : existing.contractId;
    const nextLocationId =
      parsed.data.locationId !== undefined
        ? parsed.data.locationId?.trim() || null
        : existing.locationId;
    const nextPositionId =
      parsed.data.positionId !== undefined
        ? parsed.data.positionId?.trim() || null
        : existing.positionId;

    const validated = await validateRouteAssignment({
      contractId: nextContractId,
      locationId: nextLocationId,
      positionId: nextPositionId,
    });

    const data: Record<string, unknown> = {};
    if (parsed.data.code !== undefined) data.code = parsed.data.code.toUpperCase();
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.description !== undefined) data.description = parsed.data.description?.trim() || null;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

    if (
      parsed.data.contractId !== undefined ||
      parsed.data.locationId !== undefined ||
      parsed.data.positionId !== undefined
    ) {
      data.contractId = validated.contractId;
      data.locationId = validated.locationId;
      data.positionId = validated.positionId;
    }

    const route = await prisma.patrolRoute.update({ where: { id: params.id }, data });

    const phones = await getRoutePhones(route.id);
    const full = await prisma.patrolRoute.findUnique({
      where: { id: route.id },
      include: {
        contract: { select: { id: true, licitacionNo: true, client: true } },
        location: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
        schedules: { orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }] },
      },
    });
    return ok({ ...full, phones });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return badRequest("Ya existe una ruta con ese código");
    }
    return serverError("Error al actualizar ruta", e);
  }
}, "recorridos.rutas", "edit");

export const DELETE = withPermission<Params>(async (_req, { params }) => {
  try {
    const existing = await prisma.patrolRoute.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Ruta no encontrada");
    await prisma.patrolRoute.delete({ where: { id: params.id } });
    return noContent();
  } catch (e) {
    return serverError("Error al eliminar ruta", e);
  }
}, "recorridos.rutas", "admin");
