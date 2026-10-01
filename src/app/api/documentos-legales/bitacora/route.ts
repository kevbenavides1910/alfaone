import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, ok, serverError } from "@/lib/api/response";
import { parsePaymentCompanyParams } from "@/modules/pagos/services/payment-company-filter";
import { listLegalDocumentChangeLogs } from "@/modules/documentos-legales/services/changelog";

export const GET = withPermission(async (req: NextRequest) => {
  try {
    const month = req.nextUrl.searchParams.get("month") ?? undefined;
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      return badRequest("Formato de mes inválido (esperado YYYY-MM)");
    }
    const companies = parsePaymentCompanyParams(req.nextUrl.searchParams);
    const rows = await listLegalDocumentChangeLogs({
      month,
      companies: companies.length ? companies : undefined,
    });
    return ok(rows);
  } catch (error) {
    return serverError("Error al obtener la bitácora", error);
  }
}, "documentosLegales.calendario");
