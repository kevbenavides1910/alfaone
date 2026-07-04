import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { alarmCodeSchema } from "@/modules/bandeco/validations/schemas";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "view")) return forbidden();

  try {
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const codes = await prisma.bandecoAlarmCode.findMany({
      where: q
        ? {
            OR: [
              { finca: { contains: q, mode: "insensitive" } },
              { zona: { contains: q, mode: "insensitive" } },
              { motorizado: { contains: q, mode: "insensitive" } },
              ...(Number.isFinite(Number(q)) ? [{ alarmNumber: Number(q) }] : []),
            ],
          }
        : undefined,
      include: { pantalla: true },
      orderBy: [{ alarmNumber: "asc" }],
    });
    return ok(codes);
  } catch (e) {
    return serverError("Error al listar códigos de alarma", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = alarmCodeSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const data = {
      ...parsed.data,
      bodycam: parsed.data.bodycam ?? null,
      grupoWsp: parsed.data.grupoWsp ?? null,
      encargado: parsed.data.encargado ?? null,
      numeroEncargado: parsed.data.numeroEncargado ?? null,
    };

    const created_ = await prisma.bandecoAlarmCode.create({ data });
    return created(created_);
  } catch (e) {
    return serverError("Error al crear código de alarma", e);
  }
}
