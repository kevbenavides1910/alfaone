import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import {
  listCalendarioAdminCandidates,
  listCalendarioContracts,
  listCalendarioZones,
} from "@/modules/naf-operaciones/services/calendario-opciones";
import { listCalendarioEventTypes } from "@/modules/naf-operaciones/services/calendario-tipos";

/** GET /api/naf-operaciones/calendario/opciones[?zoneId=] → zonas, tipos, administradores y contratos vigentes (de la zona). */
export const GET = withPermission(async (req: NextRequest) => {
  try {
    const zoneId = req.nextUrl.searchParams.get("zoneId") || null;
    const [zones, types, admins, contracts] = await Promise.all([
      listCalendarioZones(),
      listCalendarioEventTypes(),
      listCalendarioAdminCandidates(),
      listCalendarioContracts({ zoneId }),
    ]);
    return ok({ zones, types, admins, contracts });
  } catch (e) {
    return serverError("Error al cargar opciones del calendario", e);
  }
}, "nafOperaciones.calendario", "view");
