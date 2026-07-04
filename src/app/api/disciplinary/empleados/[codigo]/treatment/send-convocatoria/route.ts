import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { canManageDisciplinary } from "@/modules/core/permissions";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";
import {
  parseHoraConvocatoria,
  parseLocalDateOnly,
  sendDisciplinaryConvocatoriaEmail,
} from "@/modules/disciplinario/services/disciplinary-convocatoria-send";

const PostSchema = z.object({
  fechaConvocatoria: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado YYYY-MM-DD"),
  horaConvocatoria: z.string().trim().min(1, "Indique la hora de la convocatoria"),
  accion: z.string().trim().max(200).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageDisciplinary(session)) return forbidden();

  try {
    const { codigo: codigoRaw } = await params;
    const codigo = normalizeEmployeeCode(decodeURIComponent(codigoRaw));
    if (!codigo) return badRequest("Código de empleado vacío");

    const body = await req.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Datos inválidos", parsed.error.flatten());
    }

    const fechaConvocatoria = parseLocalDateOnly(parsed.data.fechaConvocatoria);
    if (!fechaConvocatoria) return badRequest("Fecha de convocatoria inválida");

    const hora = parseHoraConvocatoria(parsed.data.horaConvocatoria);
    if (!hora) return badRequest("Hora inválida (use formato HH:MM, 24 h)");

    const result = await sendDisciplinaryConvocatoriaEmail({
      codigo,
      fechaConvocatoria,
      horaConvocatoria: hora,
      accion: parsed.data.accion ?? "Pendiente",
    });

    return ok({
      enviadoA: result.to,
      cc: result.cc ?? null,
      nombre: result.nombre,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al enviar convocatoria";
    if (
      msg.includes("correo") ||
      msg.includes("SMTP") ||
      msg.includes("Hora") ||
      msg.includes("Código")
    ) {
      return badRequest(msg);
    }
    return serverError(msg, e);
  }
}
