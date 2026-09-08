import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { listAllPaymentChangeLogs } from "@/modules/pagos/services/payment-update";
import { parsePaymentCompanyParams } from "@/modules/pagos/services/payment-company-filter";

/**
 * GET /api/pagos/bitacora[?company=&companies=&limit=]
 * Bitácora global de cambios del módulo de pagos.
 */
export const GET = withPermission(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const companies = parsePaymentCompanyParams(searchParams);
    const limitRaw = searchParams.get("limit");
    const take = limitRaw ? Number(limitRaw) : 200;
    const logs = await listAllPaymentChangeLogs({
      company: companies.length ? companies : undefined,
      take: Number.isFinite(take) ? take : 200,
    });
    return ok(logs);
  } catch (e) {
    return serverError("Error al obtener la bitácora de pagos", e);
  }
}, "pagos.calendario", "view");
