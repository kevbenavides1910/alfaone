import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { listPagoProveedores } from "@/modules/pagos/services/pago-proveedores";
import { parsePaymentCompanyParams } from "@/modules/pagos/services/payment-company-filter";

/**
 * GET /api/pagos/proveedores?company=&companies=&oc=
 * Cola de gastos aprobados. `oc` también resuelve N° factura NAF → OC.
 */
export const GET = withPermission(async (req: NextRequest) => {
  try {
    const companies = parsePaymentCompanyParams(req.nextUrl.searchParams);
    const companyFilter = companies.length ? companies : undefined;
    const oc = req.nextUrl.searchParams.get("oc")?.trim() || undefined;
    const data = await listPagoProveedores(companyFilter, oc, { includePaid: true });
    return ok(data);
  } catch (e) {
    return serverError("Error al listar pago proveedores", e);
  }
}, "pagos.calendario", "view");
