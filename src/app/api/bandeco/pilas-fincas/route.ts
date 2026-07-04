import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { pilaFincaSchema } from "@/modules/bandeco/validations/schemas";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (
    !requirePermission(session, "bandeco.mantenimientos", "view") &&
    !requirePermission(session, "bandeco.operacion", "view")
  ) {
    return forbidden();
  }

  try {
    const rows = await prisma.bandecoPilaFinca.findMany({ orderBy: { finca: "asc" } });
    return ok(rows);
  } catch (e) {
    return serverError("Error al listar fincas de pilas", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = pilaFincaSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await prisma.bandecoPilaFinca.create({
      data: {
        ...parsed.data,
        desmane: parsed.data.desmane ?? null,
        paneo: parsed.data.paneo ?? null,
        zonaMotorizado: parsed.data.zonaMotorizado ?? null,
        observaciones: parsed.data.observaciones ?? null,
      },
    });
    return created(row);
  } catch (e) {
    return serverError("Error al crear finca de pilas", e);
  }
}
