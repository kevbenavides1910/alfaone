import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { canManageDisciplinaryConvocatoria } from "@/modules/core/permissions";
import { ok, unauthorized, forbidden, badRequest, notFound, serverError } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";
import {
  parseHoraConvocatoria,
  parseLocalDateOnly,
} from "@/modules/disciplinario/services/disciplinary-convocatoria-send";

const PutSchema = z.object({
  fechaConvocatoria: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado YYYY-MM-DD"),
  horaConvocatoria: z.string().trim().min(1, "Indique la hora"),
});

/** Actualiza solo fecha y hora de convocatoria (no toca acción ni cobrado). */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageDisciplinaryConvocatoria(session)) return forbidden();

  try {
    const { codigo: codigoRaw } = await params;
    const codigo = normalizeEmployeeCode(decodeURIComponent(codigoRaw));
    if (!codigo) return badRequest("Código de empleado vacío");

    const body = await req.json();
    const parsed = PutSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Datos inválidos", parsed.error.flatten());
    }

    const fechaConvocatoria = parseLocalDateOnly(parsed.data.fechaConvocatoria);
    if (!fechaConvocatoria) return badRequest("Fecha de convocatoria inválida");

    const hora = parseHoraConvocatoria(parsed.data.horaConvocatoria);
    if (!hora) return badRequest("Hora inválida (use formato HH:MM, 24 h)");

    const hasAny = await prisma.disciplinaryApercibimiento.findFirst({
      where: { codigoEmpleado: codigo },
      select: { nombreEmpleado: true, zona: true },
    });
    const existing = await prisma.disciplinaryTreatment.findUnique({
      where: { codigoEmpleado: codigo },
      select: { id: true },
    });
    if (!hasAny && !existing) {
      return notFound("No hay apercibimientos para ese código");
    }

    const treatment = await prisma.disciplinaryTreatment.upsert({
      where: { codigoEmpleado: codigo },
      create: {
        codigoEmpleado: codigo,
        codigoEmpleadoRaw: codigo,
        nombre: hasAny?.nombreEmpleado ?? null,
        zona: hasAny?.zona ?? null,
        fechaConvocatoria,
        horaConvocatoria: hora,
      },
      update: {
        fechaConvocatoria,
        horaConvocatoria: hora,
      },
    });

    return ok({
      codigoEmpleado: treatment.codigoEmpleado,
      fechaConvocatoria: parsed.data.fechaConvocatoria,
      horaConvocatoria: hora,
    });
  } catch (e) {
    return serverError(
      e instanceof Error ? e.message : "Error al actualizar convocatoria",
      e,
    );
  }
}
