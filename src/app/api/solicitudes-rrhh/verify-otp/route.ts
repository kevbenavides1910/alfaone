import { NextRequest } from "next/server";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOtpSchema } from "@/modules/solicitudes-rrhh/validations/schemas";
import { verifyOtpAndIssueDownloadToken } from "@/modules/solicitudes-rrhh/services/otp";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`hr-doc-verify:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return badRequest(`Demasiados intentos. Espere ${rl.retryAfterSec}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  try {
    const result = await verifyOtpAndIssueDownloadToken(parsed.data);
    if ("error" in result) return badRequest(result.error);
    return ok({
      downloadToken: result.downloadToken,
      message: "Código verificado. Ya puede descargar el documento.",
    });
  } catch (e) {
    return serverError("Error al verificar el código", e);
  }
}
