import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, created, ok, serverError } from "@/lib/api/response";
import { parsePaymentCompanyParams } from "@/modules/pagos/services/payment-company-filter";
import { getLegalCalendarMonth, createLegalDocument } from "@/modules/documentos-legales/services/documents";
import { LegalDocumentError } from "@/modules/documentos-legales/services/errors";
import {
  legalDocumentBodySchema,
  zodErrorMessage,
} from "@/modules/documentos-legales/validations/document.schema";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const GET = withPermission(async (req: NextRequest) => {
  try {
    const month = req.nextUrl.searchParams.get("month") ?? currentMonth();
    if (!/^\d{4}-\d{2}$/.test(month)) return badRequest("Formato de mes inválido (esperado YYYY-MM)");
    const companies = parsePaymentCompanyParams(req.nextUrl.searchParams);
    const calendar = await getLegalCalendarMonth(month, companies.length ? companies : undefined);
    return ok(calendar);
  } catch (error) {
    if (error instanceof LegalDocumentError) return badRequest(error.message);
    return serverError("Error al obtener el calendario de documentos legales", error);
  }
}, "documentosLegales.calendario");

export const POST = withPermission(async (req: NextRequest, ctx) => {
  try {
    const userId = ctx.session.user?.id;
    if (!userId) return badRequest("Sesión sin usuario");
    const parsed = legalDocumentBodySchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(zodErrorMessage(parsed.error));
    const createdDoc = await createLegalDocument(parsed.data, userId);
    return created(createdDoc);
  } catch (error) {
    if (error instanceof LegalDocumentError) {
      return error.code === "NOT_FOUND" ? badRequest(error.message) : badRequest(error.message);
    }
    return serverError("Error al crear el documento legal", error);
  }
}, "documentosLegales.calendario", "edit");
