import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  created,
} from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import {
  ALLOWED_FACTURACION_MIMES,
  MAX_FACTURACION_FILE_BYTES,
  facturaRequisitoDir,
  storagePathForRequisito,
  FACTURACION_UPLOAD_ROOT,
} from "@/modules/presupuestos/services/facturacion-uploads";
import { serializeFacturaMensual } from "@/modules/presupuestos/services/facturacion-cobro";
import { facturaListSerializeInclude } from "@/modules/presupuestos/services/facturacion-includes";
import {
  detectMimeFromBuffer,
  mimeMatchesDeclared,
} from "@/lib/security/file-validation";
import { readFile } from "fs/promises";
import { resolveUnderRoot } from "@/lib/security/path-safety";

type Ctx = { params: Promise<{ id: string; requisitoId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "edit")) return forbidden();

  const { id: facturaId, requisitoId } = await params;

  try {
    const factura = await prisma.facturaMensual.findUnique({
      where: { id: facturaId },
      include: { requisitos: { where: { id: requisitoId } } },
    });
    if (!factura) return notFound("Factura mensual no encontrada");
    if (factura.status === "FACTURADO" || factura.status === "COBRADO") {
      return badRequest("No se pueden subir archivos a una factura cerrada");
    }

    const requisito = factura.requisitos[0];
    if (!requisito) return notFound("Requisito no encontrado");

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return badRequest("Archivo requerido");

    const blob = file as File;
    if (blob.size > MAX_FACTURACION_FILE_BYTES) {
      return badRequest("Archivo demasiado grande (máximo 15 MB)");
    }

    const buf = Buffer.from(await blob.arrayBuffer());
    const detected = detectMimeFromBuffer(buf);
    const declared = blob.type || "application/octet-stream";
    if (!ALLOWED_FACTURACION_MIMES.has(declared)) {
      return badRequest("Tipo de archivo no permitido (PDF, imágenes, Word o Excel)");
    }
    if (!mimeMatchesDeclared(detected, declared)) {
      return badRequest("El contenido del archivo no coincide con el tipo declarado");
    }
    const mime = detected !== "application/octet-stream" ? detected : declared;

    const originalName = blob.name || "entregable";
    const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const storedName = `${Date.now()}_${safe}`;

    const dir = facturaRequisitoDir(facturaId, requisitoId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, storedName), buf);

    const rel = storagePathForRequisito(facturaId, requisitoId, storedName);

    await prisma.$transaction([
      prisma.facturaRequisito.update({
        where: { id: requisitoId },
        data: {
          filePath: rel,
          fileName: originalName.slice(0, 255),
          mimeType: mime,
          status: "COMPLETADO",
          uploadedAt: new Date(),
        },
      }),
      ...(factura.status === "PENDIENTE"
        ? [
            prisma.facturaMensual.update({
              where: { id: facturaId },
              data: { status: "EN_PROCESO" },
            }),
          ]
        : []),
    ]);

    const updated = await prisma.facturaMensual.findUniqueOrThrow({
      where: { id: facturaId },
      include: facturaListSerializeInclude,
    });

    return created(serializeFacturaMensual(updated));
  } catch (e) {
    return serverError("Error al subir entregable", e);
  }
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "view")) return forbidden();

  const { id: facturaId, requisitoId } = await params;

  try {
    const requisito = await prisma.facturaRequisito.findFirst({
      where: { id: requisitoId, facturaMensualId: facturaId },
    });
    if (!requisito?.filePath) return notFound("Archivo no encontrado");

    const abs = resolveUnderRoot(FACTURACION_UPLOAD_ROOT, requisito.filePath);
    if (!abs) return notFound();
    const buf = await readFile(abs).catch(() => null);
    if (!buf) return notFound();

    const mime = requisito.mimeType ?? "application/octet-stream";
    const safeInline =
      req.nextUrl.searchParams.get("inline") === "1" &&
      (mime.startsWith("image/") || mime === "application/pdf");
    const disposition = safeInline ? "inline" : "attachment";
    const fileName = requisito.fileName ?? "entregable";

    return new Response(buf, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return serverError("Error al descargar entregable", e);
  }
}
