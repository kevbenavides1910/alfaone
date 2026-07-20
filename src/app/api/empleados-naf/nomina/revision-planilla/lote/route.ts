import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { getLatestPagoLote } from "@/modules/empleados-naf/services/revision-planilla-pago-flujo";
import { isNafOracleWriteConfigured } from "@/modules/empleados-naf/services/oracle-client";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.revisionPlanilla", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const noCia = sp.get("noCia")?.trim();
    const codPla = sp.get("codPla")?.trim();
    const fDesde = sp.get("fDesde")?.trim();
    const fHasta = sp.get("fHasta")?.trim();
    if (!noCia || !codPla || !fDesde || !fHasta) {
      return badRequest("Parámetros requeridos: noCia, codPla, fDesde, fHasta");
    }
    const lote = await getLatestPagoLote({ noCia, codPla, fDesde, fHasta });
    return ok({
      writeConfigured: isNafOracleWriteConfigured(),
      lote: lote
        ? {
            id: lote.id,
            empleados: lote.empleados,
            totalCheque: Number(lote.totalCheque),
            totalDav: Number(lote.totalDav),
            totalBn: Number(lote.totalBn),
            totalOtro: Number(lote.totalOtro),
            totalGeneral: Number(lote.totalGeneral),
            secuencias: lote.secuencias,
            createdAt: lote.createdAt,
          }
        : null,
    });
  } catch (e) {
    return serverError("Error al consultar lote de pago", e);
  }
}
