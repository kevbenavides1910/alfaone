import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { isPlatformAdmin } from "@/lib/permissions/check";
import { ok, badRequest, notFound, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { deleteRole, getRoleById, updateRole } from "@/modules/plataforma/services/roles";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const permSchema = z.object({
  permissionKey: z.string(),
  level: z.enum(["none", "view", "edit", "admin"]),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  permissions: z.array(permSchema).optional(),
});

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: unauthorized() as Response };
  if (!isPlatformAdmin(session)) return { error: forbidden() as Response };
  return { session };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  try {
    const { id } = await params;
    const role = await getRoleById(prisma, id);
    if (!role) return notFound("Rol no encontrado");
    return ok(role);
  } catch (e) {
    return serverError("Error al obtener rol", e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    const role = await updateRole(prisma, id, parsed.data);
    if (!role) return notFound("Rol no encontrado");
    return ok(role);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al actualizar rol";
    return badRequest(msg);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  try {
    const { id } = await params;
    await deleteRole(prisma, id);
    return ok({ deleted: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al eliminar rol";
    return badRequest(msg);
  }
}
