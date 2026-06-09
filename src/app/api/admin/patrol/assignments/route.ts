import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { ok, created, badRequest, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { ensurePatrolDeviceForPosition } from "@/modules/syntra/services/patrol-device-sync-service";
import { resolveDevicePositionLabel } from "@/modules/syntra/services/patrol-inventory-phone-service";

const createSchema = z.object({
  positionId: z.string().trim().min(1),
  routeId: z.string().trim().min(1),
  validFrom: z.string().trim().min(8),
  validUntil: z.string().trim().optional().nullable(),
});

function parseDateOnly(raw: string): Date {
  const d = raw.includes("T") ? raw.slice(0, 10) : raw;
  return new Date(`${d}T00:00:00.000Z`);
}

export const GET = withPermission(async () => {
  try {
    const rows = await prisma.patrolAssignment.findMany({
      orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
      include: {
        device: {
          select: {
            id: true,
            imei: true,
            employeeCode: true,
            label: true,
            isActive: true,
            positionId: true,
            locationDesc: true,
          },
        },
        route: { select: { id: true, code: true, name: true, isActive: true } },
      },
    });

    const enriched = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        positionName: row.device ? await resolveDevicePositionLabel(row.device) : "",
      })),
    );

    return ok(enriched);
  } catch (e) {
    return serverError("Error al listar asignaciones", e);
  }
}, "recorridos.asignaciones", "view");

export const POST = withPermission(async (req: NextRequest) => {
  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const device = await ensurePatrolDeviceForPosition(parsed.data.positionId);
    if (!device) {
      return badRequest("No hay celular asignado a ese puesto en inventario");
    }

    const route = await prisma.patrolRoute.findUnique({ where: { id: parsed.data.routeId } });
    if (!route) return badRequest("Ruta no encontrada");

    const validFrom = parseDateOnly(parsed.data.validFrom);
    const validUntil = parsed.data.validUntil?.trim()
      ? parseDateOnly(parsed.data.validUntil)
      : null;

    const row = await prisma.patrolAssignment.create({
      data: {
        deviceId: device.id,
        routeId: parsed.data.routeId,
        validFrom,
        validUntil,
      },
      include: {
        device: {
          select: {
            id: true,
            imei: true,
            employeeCode: true,
            label: true,
            positionId: true,
            locationDesc: true,
          },
        },
        route: { select: { id: true, code: true, name: true } },
      },
    });

    return created({
      ...row,
      positionName: await resolveDevicePositionLabel(row.device),
    });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return badRequest("Ya existe esa asignación para la fecha indicada");
    }
    return serverError("Error al crear asignación", e);
  }
}, "recorridos.asignaciones", "edit");
