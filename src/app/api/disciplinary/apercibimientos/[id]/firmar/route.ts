import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { canManageDisciplinary } from "@/modules/core/permissions";
import {
  ok,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api/response";
import { firmarApercibimientoConCorreo } from "@/modules/disciplinario/services/disciplinary-firma-send";

const bodySchema = z.object({
  signatureDataUrl: z.string().min(32).max(700_000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageDisciplinary(session)) return forbidden();

  try {
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Firma inválida", parsed.error.flatten());

    const result = await firmarApercibimientoConCorreo(id, parsed.data.signatureDataUrl);
    if (!result.ok) {
      if (result.status === 404) return notFound(result.error);
      if (result.status === 400 || result.status === 409) return badRequest(result.error);
      if (result.status === 502) return serverError(result.error);
      return badRequest(result.error);
    }

    return ok({
      id: result.id,
      numero: result.numero,
      emailSent: result.emailSent,
      emailTo: result.emailTo,
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Error al firmar apercibimiento", e);
  }
}
