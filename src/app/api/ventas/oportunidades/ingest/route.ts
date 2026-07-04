import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/api/cron-auth";
import { created, badRequest, unauthorized, serverError } from "@/lib/api/response";
import { ingestOportunidades, oportunidadIngestSchema } from "@/modules/ventas";

/**
 * Endpoint para automatización n8n (revisión diaria de licitaciones).
 * Autenticación: Bearer SYNTRA_CRON_SECRET o ?secret=...
 *
 * Acepta un objeto o un lote:
 * { licitacionNo, cliente, descripcion, fechaPresentacion, enlace? }
 * { licitaciones: [...] }
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return unauthorized("No autorizado");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = oportunidadIngestSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const result = await ingestOportunidades(parsed.data);
    return created(result);
  } catch (e) {
    return serverError("Error al registrar licitaciones", e);
  }
}
