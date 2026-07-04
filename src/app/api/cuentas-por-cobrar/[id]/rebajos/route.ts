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
import { cxcRebajoBodySchema } from "@/modules/presupuestos/validations/cuentas-por-cobrar.schema";
import {
  createCxcRebajo,
  serializeCuentaPorCobrar,
  cxcDocumentInclude,
} from "@/modules/presupuestos/services/cuentas-por-cobrar";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cxc", "edit")) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = cxcRebajoBodySchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const result = await createCxcRebajo(prisma, id, parsed.data, session.user.id);
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
    return serverError("Error al registrar rebajo", e);
  }
}
