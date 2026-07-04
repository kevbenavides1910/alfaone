import { NextRequest } from "next/server";
import { getSession, canManageExpenses } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { assetMovementActionSchema } from "@/modules/inventario/validations/asset.schema";
import {
  validateAndApplyAssetMovement,
  listMovementsForAsset,
} from "@/modules/inventario/services/asset-movements";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageExpenses(session)) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = assetMovementActionSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const outcome = await validateAndApplyAssetMovement(id, parsed.data, session.user.id);
    if (!outcome.ok) {
      if (outcome.notFound) return notFound();
      return badRequest(outcome.error.message);
    }
    return created(outcome.result);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return serverError(`Error al registrar movimiento: ${detail}`, e);
  }
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;
  try {
    const movements = await listMovementsForAsset(id);
    return ok(movements);
  } catch (e) {
    return serverError("Error al obtener movimientos", e);
  }
}
