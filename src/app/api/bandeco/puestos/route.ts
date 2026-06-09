import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { puestoSchema } from "@/modules/bandeco/validations/schemas";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "view")) return forbidden();

  try {
    const rows = await prisma.bandecoPuesto.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    return ok(rows);
  } catch (e) {
    return serverError("Error al listar puestos", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = puestoSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await prisma.bandecoPuesto.create({ data: parsed.data });
    return created(row);
  } catch (e) {
    return serverError("Error al crear puesto", e);
  }
}
