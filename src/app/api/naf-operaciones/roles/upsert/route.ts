import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { OpWriteNotAvailableError, upsertOpRol } from "@/modules/naf-operaciones/services/op-write";

const BodySchema = z.object({
  noCiaGrupo: z.string().trim().min(1),
  noContrato: z.string().trim().min(1),
  noUbicacion: z.string().trim().min(1),
  noRol: z.coerce.number().int().positive(),
  semanaPgr: z.coerce.number().int().min(0),
  diaSemana: z.string().trim().min(1).max(1),
  tipoJornada: z.string().trim().optional().nullable(),
  horas: z.coerce.number().optional().nullable(),
  estado: z.string().trim().optional().nullable(),
  perfil: z.string().trim().optional().nullable(),
  semanasPgr: z.coerce.number().int().optional().nullable(),
  inicio: z.string().optional().nullable(),
  fin: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "nafOperaciones.programacion", "edit")) return forbidden();

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    const body = parsed.data;
    const result = await upsertOpRol({
      ...body,
      inicio: body.inicio ? new Date(body.inicio) : null,
      fin: body.fin ? new Date(body.fin) : null,
      usuario: session.user?.email ?? session.user?.id ?? "ALFA_ONE",
    });
    return ok(result);
  } catch (e) {
    if (e instanceof OpWriteNotAvailableError) return badRequest(e.message);
    return serverError("Error al guardar rol OP", e);
  }
}
