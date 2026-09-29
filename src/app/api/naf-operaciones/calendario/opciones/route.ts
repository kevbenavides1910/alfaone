import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import {
  listCalendarioContracts,
  listCalendarioZones,
} from "@/modules/naf-operaciones/services/calendario-opciones";

/** GET /api/naf-operaciones/calendario/opciones[?zoneId=] → zonas operativas + contratos vigentes (de la zona). */
export const GET = withPermission(async (req: NextRequest) => {
  try {
    const zoneId = req.nextUrl.searchParams.get("zoneId") || null;
    const [zones, contracts] = await Promise.all([
      listCalendarioZones(),
      listCalendarioContracts({ zoneId }),
    ]);
    return ok({ zones, contracts });
  } catch (e) {
    return serverError("Error al cargar zonas y contratos", e);
  }
}, "nafOperaciones.calendario", "view");
