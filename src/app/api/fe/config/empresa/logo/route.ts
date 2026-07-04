import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, notFound, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import {
  detectMimeFromBuffer,
  mimeMatchesDeclared,
} from "@/lib/security/file-validation";
import { FeEmpresaConfigController } from "@/modules/facturacion-electronica/controllers/empresa-config.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCodeFromSession } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { feAbsolutePath } from "@/modules/facturacion-electronica/utils/fe-storage";

const controller = new FeEmpresaConfigController(prisma);

const ALLOWED_LOGO_MIMES = new Set(["image/png", "image/jpeg"]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.config", "view")) return forbidden();

  try {
    const companyCode = resolveFeCompanyCodeFromSession(
      session,
      new URL(req.url).searchParams.get("companyCode")
    );
    const empresa = await controller.getConfig(companyCode);
    if (!empresa.configured || !empresa.empresa?.logoPath) {
      return notFound("Sin logo configurado");
    }

    const abs = feAbsolutePath(empresa.empresa.logoPath);
    const buf = await import("fs/promises").then((fs) => fs.readFile(abs));
    const lower = empresa.empresa.logoPath.toLowerCase();
    const mime = lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" : "image/png";

    return new Response(buf, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.config", "edit")) return forbidden();

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return badRequest("Archivo requerido");

    const blob = file as File;
    if (blob.size > MAX_LOGO_BYTES) {
      return badRequest(`Logo demasiado grande (máximo ${MAX_LOGO_BYTES / (1024 * 1024)} MB)`);
    }

    const buf = Buffer.from(await blob.arrayBuffer());
    const detected = detectMimeFromBuffer(buf);
    const declared = blob.type || "application/octet-stream";

    if (!ALLOWED_LOGO_MIMES.has(detected) && !ALLOWED_LOGO_MIMES.has(declared)) {
      return badRequest("Solo se permiten imágenes PNG o JPEG");
    }
    if (
      declared !== "application/octet-stream" &&
      !mimeMatchesDeclared(detected, declared)
    ) {
      return badRequest("El contenido del archivo no coincide con el tipo de imagen declarado");
    }

    const mime =
      detected !== "application/octet-stream" && ALLOWED_LOGO_MIMES.has(detected)
        ? detected
        : ALLOWED_LOGO_MIMES.has(declared)
          ? declared
          : detected;

    const companyCode = resolveFeCompanyCodeFromSession(
      session,
      typeof form.get("companyCode") === "string" ? String(form.get("companyCode")) : undefined
    );

    const empresa = await controller.uploadLogo(
      companyCode,
      { buffer: buf, mime },
      session.user.id
    );
    return ok(empresa);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.config", "edit")) return forbidden();

  try {
    const companyCode = resolveFeCompanyCodeFromSession(
      session,
      new URL(req.url).searchParams.get("companyCode")
    );
    const empresa = await controller.clearLogo(companyCode, session.user.id);
    return ok(empresa);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
