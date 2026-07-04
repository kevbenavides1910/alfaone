import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { FeEmpresaConfigController } from "@/modules/facturacion-electronica/controllers/empresa-config.controller";
import { mapFeErrorToResponse } from "@/modules/facturacion-electronica/errors/error-mapper";
import { resolveFeCompanyCodeFromSession } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import { uploadFeCertificadoSchema } from "@/modules/facturacion-electronica/validators/empresa.schema";

const controller = new FeEmpresaConfigController(prisma);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacionElectronica.config", "edit")) return forbidden();

  try {
    const form = await req.formData();
    const file = form.get("file");
    const password = form.get("password");
    if (!file || typeof file === "string") return badRequest("Archivo .p12 requerido");

    const parsedPwd = uploadFeCertificadoSchema.safeParse({ password });
    if (!parsedPwd.success) return badRequest("Contraseña inválida", parsedPwd.error.flatten());

    const blob = file as File;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const companyCode = resolveFeCompanyCodeFromSession(
      session,
      typeof form.get("companyCode") === "string" ? String(form.get("companyCode")) : undefined
    );

    const forAmbienteRaw = form.get("forAmbiente");
    const forAmbiente =
      forAmbienteRaw === "STAGING" || forAmbienteRaw === "PRODUCCION"
        ? (forAmbienteRaw as "STAGING" | "PRODUCCION")
        : undefined;

    const empresa = await controller.uploadCertificado(
      companyCode,
      { name: blob.name || "certificado.p12", buffer },
      parsedPwd.data.password,
      session.user.id,
      forAmbiente
    );
    return ok(empresa);
  } catch (e) {
    return mapFeErrorToResponse(e);
  }
}
