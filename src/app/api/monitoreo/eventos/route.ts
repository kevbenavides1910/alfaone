import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import type { Prisma } from "@prisma/client";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { eventoSchema } from "@/modules/monitoreo/validations/schemas";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "monitoreo.registros", "view")) return forbidden();

  try {
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "200");
    const rows = await prisma.bandecoEvento.findMany({
      orderBy: { fecha: "desc" },
      take: Number.isFinite(limit) ? limit : 200,
    });
    return ok(rows);
  } catch (e) {
    return serverError("Error al listar eventos", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "monitoreo.operacion", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = eventoSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const now = new Date();
    const imagenes = parsed.data.imagenes ?? [];
    const row = await prisma.bandecoEvento.create({
      data: {
        finca: parsed.data.finca,
        motivo: parsed.data.motivo ?? null,
        informe: parsed.data.informe,
        operadorName: parsed.data.operadorName || session.user.name || "Operador",
        fecha: parsed.data.fecha ?? now,
        hora: parsed.data.hora ?? null,
        imagenes: imagenes as unknown as Prisma.InputJsonValue,
      },
    });
    return created(row);
  } catch (e) {
    return serverError("Error al registrar evento", e);
  }
}
