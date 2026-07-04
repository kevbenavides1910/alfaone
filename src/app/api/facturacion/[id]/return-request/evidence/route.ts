import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { forbidden, notFound, serverError, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { FACTURACION_UPLOAD_ROOT } from "@/modules/presupuestos/services/facturacion-uploads";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "view")) return forbidden();

  const { id: facturaId } = await params;

  try {
    const factura = await prisma.facturaMensual.findUnique({
      where: { id: facturaId },
      select: {
        returnRequestEvidencePath: true,
        returnRequestEvidenceFileName: true,
        returnRequestEvidenceMimeType: true,
      },
    });
    if (!factura?.returnRequestEvidencePath) {
      return notFound("Evidencia no encontrada");
    }

    const abs = resolveUnderRoot(FACTURACION_UPLOAD_ROOT, factura.returnRequestEvidencePath);
    if (!abs) return notFound();
    const buf = await readFile(abs).catch(() => null);
    if (!buf) return notFound();

    const mime = factura.returnRequestEvidenceMimeType ?? "application/octet-stream";
    const fileName = factura.returnRequestEvidenceFileName ?? "evidencia";

    return new Response(buf, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return serverError("Error al descargar evidencia", e);
  }
}
