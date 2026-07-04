import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { camaraSchema } from "@/modules/bandeco/validations/schemas";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "view")) return forbidden();

  try {
    const pantalla = req.nextUrl.searchParams.get("pantalla");
    const rows = await prisma.bandecoCamara.findMany({
      where: pantalla ? { pantallaNum: Number(pantalla) } : undefined,
      orderBy: [{ pantallaNum: "asc" }, { camaraNum: "asc" }],
    });
    return ok(rows);
  } catch (e) {
    return serverError("Error al listar cámaras", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = camaraSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await prisma.bandecoCamara.create({ data: parsed.data });
    return created(row);
  } catch (e) {
    return serverError("Error al crear cámara", e);
  }
}
