import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import { settingsPatchSchema } from "@/modules/solicitudes-rrhh/validations/schemas";
import { ensureHrDocumentSettingsRow } from "@/modules/solicitudes-rrhh/services/settings";

function cleanNullable(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "solicitudesRrhh.ajustes", "view")) return forbidden();
  try {
    const row = await ensureHrDocumentSettingsRow();
    return ok(row);
  } catch (e) {
    return serverError("Error al cargar ajustes de solicitudes RRHH", e);
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "solicitudesRrhh.ajustes", "edit")) return forbidden();
  try {
    const parsed = settingsPatchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    const body = parsed.data;

    const updates: Record<string, unknown> = {};
    if (body.signerName !== undefined) updates.signerName = body.signerName;
    if (body.signerTitle !== undefined) updates.signerTitle = body.signerTitle;
    if (body.companyLegalName !== undefined) updates.companyLegalName = body.companyLegalName;
    if (body.companyIdNumber !== undefined) updates.companyIdNumber = body.companyIdNumber;
    if (body.companyAddress !== undefined) updates.companyAddress = body.companyAddress;
    if (body.companyPhone !== undefined) updates.companyPhone = body.companyPhone;
    if (body.corporateGroupText !== undefined) updates.corporateGroupText = body.corporateGroupText;
    if (body.emailFixedCc !== undefined) updates.emailFixedCc = cleanNullable(body.emailFixedCc);
    if (body.otpSubjectTemplate !== undefined) updates.otpSubjectTemplate = body.otpSubjectTemplate;
    if (body.otpBodyTemplate !== undefined) updates.otpBodyTemplate = body.otpBodyTemplate;

    if (Object.keys(updates).length === 0) return badRequest("No hay cambios para guardar");

    await ensureHrDocumentSettingsRow();
    const row = await prisma.hrDocumentRequestSettings.update({
      where: { id: "default" },
      data: updates,
    });
    return ok(row);
  } catch (e) {
    return serverError("Error al guardar ajustes", e);
  }
}
