import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { pantallaSchema } from "@/modules/bandeco/validations/schemas";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "view")) return forbidden();

  try {
    const rows = await prisma.bandecoPantalla.findMany({
      include: { alarmCode: { select: { alarmNumber: true, finca: true, zona: true } } },
      orderBy: { alarmCode: { alarmNumber: "asc" } },
    });
    return ok(rows);
  } catch (e) {
    return serverError("Error al listar pantallas", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = pantallaSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await prisma.bandecoPantalla.create({
      data: {
        ...parsed.data,
        pantalla: parsed.data.pantalla ?? null,
        camara: parsed.data.camara ?? null,
        zonaExterna: parsed.data.zonaExterna ?? null,
        pantalla2: parsed.data.pantalla2 ?? null,
        camara2: parsed.data.camara2 ?? null,
      },
    });
    return created(row);
  } catch (e) {
    return serverError("Error al crear pantalla", e);
  }
}
