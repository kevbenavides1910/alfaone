import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { alarmCodeSchema } from "@/modules/bandeco/validations/schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();

  try {
    const { id } = await params;
    const existing = await prisma.bandecoAlarmCode.findUnique({ where: { id } });
    if (!existing) return notFound("Código no encontrado");

    const body = await req.json();
    const parsed = alarmCodeSchema.partial().safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const updated = await prisma.bandecoAlarmCode.update({
      where: { id },
      data: {
        ...parsed.data,
        bodycam: parsed.data.bodycam === undefined ? undefined : parsed.data.bodycam ?? null,
        grupoWsp: parsed.data.grupoWsp === undefined ? undefined : parsed.data.grupoWsp ?? null,
        encargado: parsed.data.encargado === undefined ? undefined : parsed.data.encargado ?? null,
        numeroEncargado:
          parsed.data.numeroEncargado === undefined ? undefined : parsed.data.numeroEncargado ?? null,
      },
    });
    return ok(updated);
  } catch (e) {
    return serverError("Error al actualizar código", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "admin")) return forbidden();

  try {
    const { id } = await params;
    const existing = await prisma.bandecoAlarmCode.findUnique({ where: { id } });
    if (!existing) return notFound("Código no encontrado");

    await prisma.bandecoAlarmCode.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar código", e);
  }
}
