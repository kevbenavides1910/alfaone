import { readFile, unlink } from "fs/promises";
import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { withPermission } from "@/lib/permissions/middleware";
import {
  notFound,
  serverError,
  noContent,
} from "@/lib/api/response";
import { PAYMENT_UPLOAD_ROOT } from "@/modules/pagos/services/payment-uploads";
import { resolveUnderRoot } from "@/lib/security/path-safety";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

/**
 * GET    /api/pagos/[id]/attachments/[attachmentId] — descarga / vista
 * DELETE /api/pagos/[id]/attachments/[attachmentId] — elimina comprobante
 */
export const GET = withPermission(async (req: NextRequest, ctx: { params: { id: string; attachmentId: string } }) => {
  try {
    const { id: paymentId, attachmentId } = ctx.params;
    const att = await prisma.paymentAttachment.findFirst({
      where: { id: attachmentId, paymentId },
    });
    if (!att) return notFound("Comprobante no encontrado");

    const abs = resolveUnderRoot(PAYMENT_UPLOAD_ROOT, att.storagePath);
    if (!abs) return notFound();
    const buf = await readFile(abs).catch(() => null);
    if (!buf) return notFound();

    const safeInline =
      req.nextUrl.searchParams.get("inline") === "1" &&
      (att.mimeType.startsWith("image/") || att.mimeType === "application/pdf");
    const disposition = safeInline ? "inline" : "attachment";

    return new Response(buf, {
      headers: {
        "Content-Type": att.mimeType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(att.fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return serverError("Error al descargar comprobante", e);
  }
}, "pagos.calendario", "view") as (req: NextRequest, ctx: Ctx) => Promise<Response>;

export const DELETE = withPermission(async (_req: NextRequest, ctx: { params: { id: string; attachmentId: string } }) => {
  try {
    const { id: paymentId, attachmentId } = ctx.params;
    const att = await prisma.paymentAttachment.findFirst({
      where: { id: attachmentId, paymentId },
    });
    if (!att) return notFound("Comprobante no encontrado");

    const abs = resolveUnderRoot(PAYMENT_UPLOAD_ROOT, att.storagePath);
    await prisma.paymentAttachment.delete({ where: { id: att.id } });
    if (abs) await unlink(abs).catch(() => undefined);

    return noContent();
  } catch (e) {
    return serverError("Error al eliminar comprobante", e);
  }
}, "pagos.calendario", "edit") as (req: NextRequest, ctx: Ctx) => Promise<Response>;
