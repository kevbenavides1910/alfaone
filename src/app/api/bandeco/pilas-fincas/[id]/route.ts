import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { pilaFincaSchema } from "@/modules/bandeco/validations/schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();

  try {
    const { id } = await params;
    const existing = await prisma.bandecoPilaFinca.findUnique({ where: { id } });
    if (!existing) return notFound("Finca no encontrada");

    const body = await req.json();
    const parsed = pilaFincaSchema.partial().safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const updated = await prisma.bandecoPilaFinca.update({
      where: { id },
      data: {
        ...parsed.data,
        desmane: parsed.data.desmane === undefined ? undefined : parsed.data.desmane ?? null,
        paneo: parsed.data.paneo === undefined ? undefined : parsed.data.paneo ?? null,
        zonaMotorizado:
          parsed.data.zonaMotorizado === undefined ? undefined : parsed.data.zonaMotorizado ?? null,
        observaciones:
          parsed.data.observaciones === undefined ? undefined : parsed.data.observaciones ?? null,
      },
    });
    return ok(updated);
  } catch (e) {
    return serverError("Error al actualizar finca de pilas", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "admin")) return forbidden();

  try {
    const { id } = await params;
    await prisma.bandecoPilaFinca.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar finca de pilas", e);
  }
}
