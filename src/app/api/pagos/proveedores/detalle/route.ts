import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, notFound, serverError } from "@/lib/api/response";
import { getOrdenCompraDetalleNaf } from "@/modules/presupuestos/services/list-ordenes-compra-naf";
import { getFacturaProveedorDetalleNaf } from "@/modules/pagos/services/naf-oc-factura";

/**
 * GET /api/pagos/proveedores/detalle?tipo=oc|factura&noOrden=&noFisico=&company=
 * Detalle NAF de OC o factura de proveedor (permiso pagos).
 */
export const GET = withPermission(async (req: NextRequest) => {
  const tipo = (req.nextUrl.searchParams.get("tipo") ?? "").trim().toLowerCase();
  const company = req.nextUrl.searchParams.get("company")?.trim() || undefined;
  const noCia = req.nextUrl.searchParams.get("noCia")?.trim() || undefined;
  const noOrden = req.nextUrl.searchParams.get("noOrden")?.trim() || undefined;
  const noFisico = req.nextUrl.searchParams.get("noFisico")?.trim() || undefined;

  try {
    if (tipo === "oc") {
      if (!noOrden) return badRequest("Se requiere noOrden");
      const data = await getOrdenCompraDetalleNaf({
        noOrden,
        company,
        noCia,
      });
      if (!data) return notFound("OC no encontrada en NAF");
      return ok({ tipo: "oc", ...data });
    }

    if (tipo === "factura") {
      if (!noFisico) return badRequest("Se requiere noFisico");
      const data = await getFacturaProveedorDetalleNaf({
        noFisico,
        companyCode: company,
        noOrden,
        noCia,
      });
      if (!data) return notFound("Factura no encontrada en NAF");
      return ok({ tipo: "factura", ...data });
    }

    return badRequest("tipo debe ser oc o factura");
  } catch (e) {
    return serverError("Error al consultar detalle NAF", e);
  }
}, "pagos.calendario", "view");
