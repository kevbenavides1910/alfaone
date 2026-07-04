import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { cxcRebajoUpdateSchema } from "@/modules/presupuestos/validations/cuentas-por-cobrar.schema";
import {
  updateCxcRebajo,
  deleteCxcRebajo,
  serializeCuentaPorCobrar,
  cxcDocumentInclude,
} from "@/modules/presupuestos/services/cuentas-por-cobrar";

type Ctx = { params: Promise<{ id: string; rebajoId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cxc", "edit")) return forbidden();

  const { id, rebajoId } = await params;
  try {
    const body = await req.json();
    const parsed = cxcRebajoUpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const result = await updateCxcRebajo(prisma, id, rebajoId, parsed.data);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") return notFound(result.message);
      return badRequest(result.message);
    }

    const updated = await prisma.cxcDocumento.findUniqueOrThrow({
      where: { id },
      include: cxcDocumentInclude,
    });

    return ok(serializeCuentaPorCobrar(updated));
  } catch (e) {
    return serverError("Error al actualizar rebajo", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cxc", "edit")) return forbidden();

  const { id, rebajoId } = await params;
  try {
    const result = await deleteCxcRebajo(prisma, id, rebajoId);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") return notFound(result.message);
      return badRequest(result.message);
    }

    const updated = await prisma.cxcDocumento.findUniqueOrThrow({
      where: { id },
      include: cxcDocumentInclude,
    });

    return ok(serializeCuentaPorCobrar(updated));
  } catch (e) {
    return serverError("Error al eliminar rebajo", e);
  }
}
