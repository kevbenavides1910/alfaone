import { NextRequest } from "next/server";
import { ok, badRequest, notFound, serverError } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { lookupSchema } from "@/modules/solicitudes-rrhh/validations/schemas";
import { resolveEmpleoByCedula } from "@/modules/solicitudes-rrhh/services/empleo-lookup";
import { maskPersonName } from "@/modules/solicitudes-rrhh/business/format";
import { HR_TRAMITE_LABELS, HR_TRAMITES } from "@/modules/solicitudes-rrhh/business/tramites";
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
  const rl = checkRateLimit(`hr-doc-lookup:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return badRequest(`Demasiados intentos. Espere ${rl.retryAfterSec}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  try {
    const cedula = normalizeCedula(parsed.data.cedula);
    if (!cedula) return badRequest("Cédula inválida");

    const empleo = await resolveEmpleoByCedula(cedula);
    if (!empleo) {
      return notFound("No se encontró un registro laboral con esa cédula.");
    }

    return ok({
      found: true,
      nombreEnmascarado: maskPersonName(empleo.nombre),
      tramites: [
        { id: HR_TRAMITES.CARTA_SERVICIO, label: HR_TRAMITE_LABELS.CARTA_SERVICIO },
        { id: HR_TRAMITES.CARTA_FCL, label: HR_TRAMITE_LABELS.CARTA_FCL },
      ],
    });
  } catch (e) {
    return serverError("Error al consultar la cédula", e);
  }
}
