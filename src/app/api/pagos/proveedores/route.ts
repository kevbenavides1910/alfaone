import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { listPagoProveedores } from "@/modules/pagos/services/pago-proveedores";

/**
 * GET /api/pagos/proveedores?company=&oc=
 * Cola de gastos aprobados. `oc` también resuelve N° factura NAF → OC.
 */
export const GET = withPermission(async (req: NextRequest) => {
  try {
    const company = req.nextUrl.searchParams.get("company")?.trim() || undefined;
    const oc = req.nextUrl.searchParams.get("oc")?.trim() || undefined;
    const data = await listPagoProveedores(company, oc, { includePaid: true });
    return ok(data);
  } catch (e) {
    return serverError("Error al listar pago proveedores", e);
  }
}, "pagos.calendario", "view");
