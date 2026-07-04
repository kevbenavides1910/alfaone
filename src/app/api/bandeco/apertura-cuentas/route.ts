import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { aperturaCuentaSchema } from "@/modules/bandeco/validations/schemas";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "view")) return forbidden();

  try {
    const finca = req.nextUrl.searchParams.get("finca")?.trim();
    const rows = await prisma.bandecoAperturaCuenta.findMany({
      where: finca ? { finca: { contains: finca, mode: "insensitive" } } : undefined,
      orderBy: [{ finca: "asc" }, { cuentaNum: "asc" }],
    });
    return ok(rows);
  } catch (e) {
    return serverError("Error al listar cuentas de apertura", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = aperturaCuentaSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await prisma.bandecoAperturaCuenta.create({ data: parsed.data });
    return created(row);
  } catch (e) {
    return serverError("Error al crear cuenta de apertura", e);
  }
}
