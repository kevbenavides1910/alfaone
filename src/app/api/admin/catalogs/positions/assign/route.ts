import { NextRequest } from "next/server";
import { getSession, isAdmin } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { z } from "zod";
import { assignPositionsToLocation } from "@/modules/presupuestos/services/contract-positions-catalog";

const schema = z.object({
  contractId: z.string().min(1),
  positionIds: z.array(z.string().min(1)).min(1),
  locationId: z.string().min(1).nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isAdmin(session)) return forbidden();

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const result = await assignPositionsToLocation(parsed.data);
    return ok(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al asignar puestos";
    return badRequest(message);
  }
}
