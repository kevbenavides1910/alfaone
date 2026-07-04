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
import { updateCxcObservationsSchema } from "@/modules/presupuestos/validations/cuentas-por-cobrar.schema";
import {
  serializeCuentaPorCobrar,
  updateCxcObservations,
  cxcDocumentInclude,
} from "@/modules/presupuestos/services/cuentas-por-cobrar";

type Ctx = { params: Promise<{ id: string }> };

const facturaInclude = cxcDocumentInclude;

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cxc", "edit")) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateCxcObservationsSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const text = parsed.data.cxcObservations?.trim() || null;
    const result = await updateCxcObservations(prisma, id, text);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") return notFound(result.message);
      return badRequest(result.message);
    }

    const updated = await prisma.cxcDocumento.findUniqueOrThrow({
      where: { id },
      include: facturaInclude,
    });

    return ok(serializeCuentaPorCobrar(updated));
  } catch (e) {
    return serverError("Error al guardar observaciones", e);
  }
}
