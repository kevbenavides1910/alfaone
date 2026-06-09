import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { aperturaCuentaSchema } from "@/modules/bandeco/validations/schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();

  try {
    const { id } = await params;
    const existing = await prisma.bandecoAperturaCuenta.findUnique({ where: { id } });
    if (!existing) return notFound("Cuenta no encontrada");

    const body = await req.json();
    const parsed = aperturaCuentaSchema.partial().safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const updated = await prisma.bandecoAperturaCuenta.update({ where: { id }, data: parsed.data });
    return ok(updated);
  } catch (e) {
    return serverError("Error al actualizar cuenta", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "admin")) return forbidden();

  try {
    const { id } = await params;
    await prisma.bandecoAperturaCuenta.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar cuenta", e);
  }
}
