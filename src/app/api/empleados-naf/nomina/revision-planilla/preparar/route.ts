import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { prepararPagosFlujo } from "@/modules/empleados-naf/services/revision-planilla-pago-flujo";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.revisionPlanilla", "edit")) return forbidden();

  try {
    const body = (await req.json()) as {
      noCia?: string;
      codPla?: string;
      fDesde?: string;
      fHasta?: string;
      replaceExisting?: boolean;
    };
    const noCia = body.noCia?.trim();
    const codPla = body.codPla?.trim();
    const fDesde = body.fDesde?.trim();
    const fHasta = body.fHasta?.trim();
    if (!noCia || !codPla || !fDesde || !fHasta) {
      return badRequest("Parámetros requeridos: noCia, codPla, fDesde, fHasta");
    }
    const result = await prepararPagosFlujo({
      noCia,
      codPla,
      fDesde,
      fHasta,
      replaceExisting: Boolean(body.replaceExisting),
      userLabel: session.user?.email ?? session.user?.name ?? session.user?.id ?? null,
    });
    return ok({
      lote: {
        id: result.lote.id,
        noCia: result.lote.noCia,
        codPla: result.lote.codPla,
        empleados: result.lote.empleados,
        totalCheque: Number(result.lote.totalCheque),
        totalDav: Number(result.lote.totalDav),
        totalBn: Number(result.lote.totalBn),
        totalOtro: Number(result.lote.totalOtro),
        totalGeneral: Number(result.lote.totalGeneral),
        secuencias: result.secuencias,
      },
      insertedNaf: result.insertedNaf,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al preparar pagos";
    if (
      message.includes("requeridos") ||
      message.includes("inválid") ||
      message.includes("Falta credencial") ||
      message.includes("debe estar aprobada") ||
      message.includes("Ya existe") ||
      message.includes("Sin cuenta origen") ||
      message.includes("escritura")
    ) {
      return badRequest(message);
    }
    return serverError("Error al preparar cheques/transferencias en NAF", e);
  }
}
