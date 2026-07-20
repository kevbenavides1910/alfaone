import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { OpWriteNotAvailableError, marcaAsistencia } from "@/modules/naf-operaciones/services/op-write";

const BodySchema = z.object({
  noCiaGrupo: z.string().trim().min(1),
  noRol: z.coerce.number().int().positive(),
  diaSemana: z.string().trim().min(1).max(1),
  ano: z.coerce.number().int().positive(),
  semana: z.coerce.number().int().positive(),
  marca: z.enum(["S", "N"]),
  horas: z.string().trim().optional().nullable(),
  observacion: z.string().trim().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "nafOperaciones.asistencia", "edit")) return forbidden();

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    const body = parsed.data;
    const result = await marcaAsistencia({
      ...body,
      usuario: session.user?.email ?? session.user?.id ?? "ALFA_ONE",
    });
    return ok(result);
  } catch (e) {
    if (e instanceof OpWriteNotAvailableError) return badRequest(e.message);
    return serverError("Error al marcar asistencia OP", e);
  }
}
