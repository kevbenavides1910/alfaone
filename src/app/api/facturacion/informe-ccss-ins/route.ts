import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { badRequest, forbidden, serverError, unauthorized } from "@/lib/api/response";
import { getContractEmployeeCedulas } from "@/modules/presupuestos/services/informe-ccss-ins-contract-employees";
import {
  buildHighlightedInformePdf,
  type InformeReportType,
} from "@/modules/presupuestos/services/informe-ccss-ins-pdf";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.informe_ccss_ins", "view")) return forbidden();

  try {
    const form = await req.formData();
    const file = form.get("file");
    const contractId = String(form.get("contractId") ?? "").trim();
    const reportType = (String(form.get("reportType") ?? "auto").trim() || "auto") as InformeReportType;

    if (!(file instanceof File)) {
      return badRequest("Debe adjuntar un archivo PDF");
    }
    if (!contractId) {
      return badRequest("Debe seleccionar un contrato");
    }
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return badRequest("El archivo debe ser PDF");
    }
    if (file.size > 25 * 1024 * 1024) {
      return badRequest("El PDF no puede superar 25 MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contractInfo = await getContractEmployeeCedulas(contractId);

    const cedulaSet = new Set(contractInfo.employees.map((e) => e.cedulaDigits));
    const employeeNames = new Map(contractInfo.employees.map((e) => [e.cedulaDigits, e.nombre]));

    const result = await buildHighlightedInformePdf({
      pdfBuffer: buffer,
      reportType,
      contractCedulaDigits: cedulaSet,
      employeeNames,
    });

    const base64 = Buffer.from(result.pdfBytes).toString("base64");
    const safeName = file.name.replace(/\.pdf$/i, "") || "informe";

    return Response.json({
      data: {
        filename: `${safeName}_resaltado.pdf`,
        pdfBase64: base64,
        reportType: result.reportType,
        contract: {
          id: contractId,
          licitacionNo: contractInfo.licitacionNo,
          client: contractInfo.client,
        },
        stats: result.stats,
        highlightedEmployees: result.highlightedEmployees,
        skippedCedulasSample: result.skippedCedulas,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al procesar el informe";
    return serverError(message, e);
  }
}
