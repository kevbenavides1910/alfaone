import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  generarArchivoBancoDesdeLote,
  type BancoArchivoCanal,
} from "@/modules/empleados-naf/services/banco-pago-archivos";
import { getLatestPagoLote } from "@/modules/empleados-naf/services/revision-planilla-pago-flujo";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.revisionPlanilla", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const canalRaw = (sp.get("canal") ?? "").trim().toUpperCase();
    const loteId = sp.get("loteId")?.trim();
    const noCia = sp.get("noCia")?.trim();
    const codPla = sp.get("codPla")?.trim();
    const fDesde = sp.get("fDesde")?.trim();
    const fHasta = sp.get("fHasta")?.trim();

    if (!["BN", "DAV", "CK"].includes(canalRaw)) {
      return badRequest("canal debe ser BN, DAV o CK");
    }
    const canal = canalRaw as BancoArchivoCanal;

    let id = loteId;
    if (!id) {
      if (!noCia || !codPla || !fDesde || !fHasta) {
        return badRequest("Indique loteId o noCia,codPla,fDesde,fHasta");
      }
      const lote = await getLatestPagoLote({ noCia, codPla, fDesde, fHasta });
      if (!lote) return badRequest("No hay lote preparado para descargar");
      id = lote.id;
    }
    if (!id) return badRequest("No hay lote preparado para descargar");

    const file = await generarArchivoBancoDesdeLote(id, canal);
    return new Response(file.body, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "X-Empleados": String(file.empleados),
        "X-Total": String(file.total),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al generar archivo";
    if (message.includes("no encontrado") || message.includes("canal") || message.includes("estado")) {
      return badRequest(message);
    }
    return serverError("Error al generar archivo bancario", e);
  }
}
