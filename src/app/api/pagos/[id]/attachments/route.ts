import { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { withPermission } from "@/lib/permissions/middleware";
import {
  ok,
  badRequest,
  notFound,
  serverError,
  created,
} from "@/lib/api/response";
import {
  ALLOWED_PAYMENT_ATTACHMENT_MIMES,
  MAX_PAYMENT_ATTACHMENT_BYTES,
  paymentAttachmentDir,
  paymentStoragePathForFile,
} from "@/modules/pagos/services/payment-uploads";
import {
  detectMimeFromBuffer,
  mimeMatchesDeclared,
} from "@/lib/security/file-validation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET  /api/pagos/[id]/attachments — lista comprobantes
 * POST /api/pagos/[id]/attachments — sube comprobante (multipart file)
 */
export const GET = withPermission(async (_req: NextRequest, ctx: { params: { id: string } }) => {
  try {
    const { id } = ctx.params;
    const payment = await prisma.payment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!payment) return notFound("Pago no encontrado");

    const rows = await prisma.paymentAttachment.findMany({
      where: { paymentId: id },
      orderBy: { createdAt: "asc" },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    return ok(
      rows.map((r) => ({
        id: r.id,
        paymentId: r.paymentId,
        fileName: r.fileName,
        mimeType: r.mimeType,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        uploadedBy: r.uploadedBy,
        downloadUrl: `/api/pagos/${id}/attachments/${r.id}`,
      })),
    );
  } catch (e) {
    return serverError("Error al listar comprobantes del pago", e);
  }
}, "pagos.calendario", "view") as (req: NextRequest, ctx: Ctx) => Promise<Response>;

export const POST = withPermission(
  async (req: NextRequest, ctx: { session: import("next-auth").Session; params: { id: string } }) => {
    try {
      const { id } = ctx.params;
      const userId = ctx.session.user?.id;
      if (!userId) return badRequest("Sesión sin usuario");

      const payment = await prisma.payment.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!payment) return notFound("Pago no encontrado");

      const form = await req.formData();
      const file = form.get("file");
      const noteRaw = form.get("note");
      const note =
        typeof noteRaw === "string" && noteRaw.trim()
          ? noteRaw.trim().slice(0, 2000)
          : null;

      if (!file || typeof file === "string") return badRequest("Archivo requerido");

      const blob = file as File;
      if (blob.size > MAX_PAYMENT_ATTACHMENT_BYTES) {
        return badRequest("Archivo demasiado grande (máximo 15 MB)");
      }

      const buf = Buffer.from(await blob.arrayBuffer());
      const detected = detectMimeFromBuffer(buf);
      const declared = blob.type || "application/octet-stream";
      if (!ALLOWED_PAYMENT_ATTACHMENT_MIMES.has(declared)) {
        return badRequest("Tipo no permitido (PDF, imágenes, Excel o CSV)");
      }
      if (!mimeMatchesDeclared(detected, declared)) {
        return badRequest("El contenido del archivo no coincide con el tipo declarado");
      }
      const mime = detected !== "application/octet-stream" ? detected : declared;

      const originalName = blob.name || "comprobante";
      const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
      const storedName = `${Date.now()}_${safe}`;

      const dir = paymentAttachmentDir(id);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, storedName), buf);

      const row = await prisma.paymentAttachment.create({
        data: {
          paymentId: id,
          uploadedById: userId,
          fileName: originalName.slice(0, 255),
          mimeType: mime,
          storagePath: paymentStoragePathForFile(id, storedName),
          note,
        },
        include: { uploadedBy: { select: { id: true, name: true } } },
      });

      return created({
        id: row.id,
        paymentId: row.paymentId,
        fileName: row.fileName,
        mimeType: row.mimeType,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
        uploadedBy: row.uploadedBy,
        downloadUrl: `/api/pagos/${id}/attachments/${row.id}`,
      });
    } catch (e) {
      return serverError("Error al subir comprobante de pago", e);
    }
  },
  "pagos.calendario",
  "edit",
) as (req: NextRequest, ctx: Ctx) => Promise<Response>;
