import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getCxpFacturaAmarres } from "@/modules/cuentas-por-pagar/services/get-cxp-factura-amarres";
import { cxpAmarresParamsSchema } from "@/modules/cuentas-por-pagar/validations/cxp-list.schema";

type RouteContext = {
  params: Promise<{ noCia: string; tipoDoc: string; noDocu: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "cuentasPorPagar.facturas", "view")) return forbidden();

  const params = await context.params;
  const { searchParams } = new URL(req.url);
  const parsed = cxpAmarresParamsSchema.safeParse({
    noCia: decodeURIComponent(params.noCia),
    tipoDoc: decodeURIComponent(params.tipoDoc),
    noDocu: decodeURIComponent(params.noDocu),
    noProve: searchParams.get("noProve") ?? undefined,
  });

  if (!parsed.success) {
    return badRequest("Parámetros inválidos", parsed.error.flatten());
  }

  try {
    const data = await getCxpFacturaAmarres(parsed.data);
    return ok(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al consultar amarres CXP";
    if (message.includes("Oracle NAF no configurado")) {
      return serverError(message, e);
    }
    return serverError("Error al consultar amarres de la factura", e);
  }
}
