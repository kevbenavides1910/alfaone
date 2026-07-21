import { NextRequest } from "next/server";
import { ok, badRequest, notFound, serverError } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { requestOtpSchema } from "@/modules/solicitudes-rrhh/validations/schemas";
import { resolveEmpleoByCedula } from "@/modules/solicitudes-rrhh/services/empleo-lookup";
import { createOtpSession } from "@/modules/solicitudes-rrhh/services/otp";
import { maskEmail } from "@/modules/solicitudes-rrhh/business/format";
import { normalizeCedula } from "@/modules/empleados/business/employee-identity";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`hr-doc-otp:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return badRequest(`Demasiados intentos. Espere ${rl.retryAfterSec}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = requestOtpSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  try {
    const cedula = normalizeCedula(parsed.data.cedula);
    if (!cedula) return badRequest("Cédula inválida");

    const rlCed = checkRateLimit(`hr-doc-otp-ced:${cedula}`, 5, 15 * 60_000);
    if (!rlCed.ok) {
      return badRequest(`Demasiadas solicitudes para esta cédula. Espere ${rlCed.retryAfterSec}s.`);
    }

    const empleo = await resolveEmpleoByCedula(cedula);
    if (!empleo) {
      return notFound("No se encontró un registro laboral con esa cédula.");
    }
    if (!empleo.email) {
      return badRequest(
        "No hay un correo registrado para esta cédula. Contacte a Recursos Humanos para actualizarlo.",
      );
    }

    const { sessionId, mailed } = await createOtpSession({
      cedulaNormalizada: cedula,
      tramite: parsed.data.tramite,
      email: empleo.email,
      empleo,
    });

    const masked = maskEmail(empleo.email);
    return ok({
      sessionId,
      emailEnmascarado: masked,
      message: mailed
        ? `Se envió un código de verificación a ${masked}.`
        : "No se pudo enviar el correo (SMTP no configurado). Contacte a Recursos Humanos.",
      mailed,
    });
  } catch (e) {
    return serverError("Error al solicitar el código", e);
  }
}
