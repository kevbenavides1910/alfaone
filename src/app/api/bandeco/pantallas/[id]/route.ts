import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { pantallaSchema } from "@/modules/bandeco/validations/schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();

  try {
    const { id } = await params;
    const existing = await prisma.bandecoPantalla.findUnique({ where: { id } });
    if (!existing) return notFound("Pantalla no encontrada");

    const body = await req.json();
    const parsed = pantallaSchema.partial().omit({ alarmCodeId: true }).safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const updated = await prisma.bandecoPantalla.update({
      where: { id },
      data: {
        ...parsed.data,
        pantalla: parsed.data.pantalla === undefined ? undefined : parsed.data.pantalla ?? null,
        camara: parsed.data.camara === undefined ? undefined : parsed.data.camara ?? null,
        zonaExterna: parsed.data.zonaExterna === undefined ? undefined : parsed.data.zonaExterna ?? null,
        pantalla2: parsed.data.pantalla2 === undefined ? undefined : parsed.data.pantalla2 ?? null,
        camara2: parsed.data.camara2 === undefined ? undefined : parsed.data.camara2 ?? null,
      },
    });
    return ok(updated);
  } catch (e) {
    return serverError("Error al actualizar pantalla", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "admin")) return forbidden();

  try {
    const { id } = await params;
    await prisma.bandecoPantalla.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar pantalla", e);
  }
}
