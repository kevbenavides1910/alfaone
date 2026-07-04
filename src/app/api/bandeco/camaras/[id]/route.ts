import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { camaraSchema } from "@/modules/bandeco/validations/schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();

  try {
    const { id } = await params;
    const existing = await prisma.bandecoCamara.findUnique({ where: { id } });
    if (!existing) return notFound("Cámara no encontrada");

    const body = await req.json();
    const parsed = camaraSchema.partial().safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const updated = await prisma.bandecoCamara.update({ where: { id }, data: parsed.data });
    return ok(updated);
  } catch (e) {
    return serverError("Error al actualizar cámara", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "admin")) return forbidden();

  try {
    const { id } = await params;
    await prisma.bandecoCamara.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar cámara", e);
  }
}
