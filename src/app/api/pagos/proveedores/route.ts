import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { listPagoProveedores } from "@/modules/pagos/services/pago-proveedores";

/**
 * GET /api/pagos/proveedores?company=
 * Cola de gastos aprobados pendientes de fecha en el calendario.
 */
export const GET = withPermission(async (req: NextRequest) => {
  try {
    const company = req.nextUrl.searchParams.get("company")?.trim() || undefined;
    const data = await listPagoProveedores(company);
    return ok(data);
  } catch (e) {
    return serverError("Error al listar pago proveedores", e);
  }
}, "pagos.calendario");
