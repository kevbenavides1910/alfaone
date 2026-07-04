import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/modules/core/db/prisma";
import { ok, badRequest, notFound, noContent, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";

const patchSchema = z.object({
  employeeCode: z.string().trim().min(1).max(40).optional(),
  password: z.string().min(4).max(100).optional(),
  label: z.string().trim().max(120).optional().nullable(),
  isActive: z.boolean().optional(),
});

type Params = { id: string };

export const GET = withPermission<Params>(async (_req, { params }) => {
  try {
    const device = await prisma.patrolDevice.findUnique({
      where: { id: params.id },
      include: {
        assignments: {
          orderBy: { validFrom: "desc" },
          take: 20,
          include: { route: { select: { id: true, code: true, name: true } } },
        },
      },
    });
    if (!device) return notFound("Dispositivo no encontrado");
    const { passwordHash: _ph, ...safe } = device;
    return ok(safe);
  } catch (e) {
    return serverError("Error al cargar dispositivo", e);
  }
}, "recorridos.dispositivos", "view");

export const PATCH = withPermission<Params>(async (req: NextRequest, { params }) => {
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const existing = await prisma.patrolDevice.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Dispositivo no encontrado");

    const data: Record<string, unknown> = {};
    if (parsed.data.employeeCode !== undefined) {
      data.employeeCode = normalizeEmployeeCode(parsed.data.employeeCode);
    }
    if (parsed.data.label !== undefined) data.label = parsed.data.label?.trim() || null;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    if (parsed.data.password) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    }

    const device = await prisma.patrolDevice.update({
      where: { id: params.id },
      data,
    });
    const { passwordHash: _ph, ...safe } = device;
    return ok(safe);
  } catch (e) {
    return serverError("Error al actualizar dispositivo", e);
  }
}, "recorridos.dispositivos", "edit");

export const DELETE = withPermission<Params>(async (_req, { params }) => {
  try {
    const existing = await prisma.patrolDevice.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Dispositivo no encontrado");
    await prisma.patrolDevice.delete({ where: { id: params.id } });
    return noContent();
  } catch (e) {
    return serverError("Error al eliminar dispositivo", e);
  }
}, "recorridos.dispositivos", "admin");
