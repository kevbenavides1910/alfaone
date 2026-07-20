import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  findDownloadSession,
  markDownloadUsed,
} from "@/modules/solicitudes-rrhh/services/otp";
import { buildHrDocumentPdf } from "@/modules/solicitudes-rrhh/services/build-document";
import type { EmpleoSnapshot } from "@/modules/solicitudes-rrhh/services/empleo-lookup";
import { isHrTramite } from "@/modules/solicitudes-rrhh/business/tramites";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`hr-doc-dl:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return badRequest(`Demasiados intentos. Espere ${rl.retryAfterSec}s.`);
  }

  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token || token.length < 32) return badRequest("Token de descarga inválido");

  try {
    const result = await findDownloadSession(token);
    if ("error" in result) {
      return badRequest(result.error);
    }

    const session = result.session;
    if (!isHrTramite(session.tramite)) return badRequest("Trámite inválido");

    const empleo = session.empleoSnapshot as EmpleoSnapshot;
    const { bytes, filename } = await buildHrDocumentPdf({
      tramite: session.tramite,
      empleo,
    });

    await markDownloadUsed(session.id);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return serverError("Error al generar el PDF", e);
  }
}
