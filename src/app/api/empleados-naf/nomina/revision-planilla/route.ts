import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getLatestNafNominaSyncRun } from "@/modules/empleados-naf/services/sync-nomina";
import {
  getRevisionPlanillaByDateRange,
  listRevisionPlanillaEmpresas,
  listRevisionPlanillaPeriodos,
  listRevisionPlanillaPlanillas,
} from "@/modules/empleados-naf/services/revision-planilla";

function parseNoCias(sp: URLSearchParams): string[] {
  const repeated = sp.getAll("noCia").flatMap((value) => value.split(","));
  const csv = sp.get("noCias");
  const values = csv ? [...repeated, ...csv.split(",")] : repeated;
  return values.map((value) => value.trim()).filter(Boolean);
}

function parseCodPlas(sp: URLSearchParams): string[] {
  const repeated = sp.getAll("codPla").flatMap((value) => value.split(","));
  const csv = sp.get("codPlas");
  const values = csv ? [...repeated, ...csv.split(",")] : repeated;
  return values.map((value) => value.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.revisionPlanilla", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const noCias = parseNoCias(sp);
    const fDesde = sp.get("fDesde");
    const fHasta = sp.get("fHasta");
    const codPlas = parseCodPlas(sp);

    const [empresas, lastSync] = await Promise.all([
      listRevisionPlanillaEmpresas(),
      getLatestNafNominaSyncRun(),
    ]);

    const periodos = noCias.length > 0 ? await listRevisionPlanillaPeriodos(noCias) : [];
    const planillas =
      noCias.length > 0
        ? await listRevisionPlanillaPlanillas(noCias, fDesde ?? undefined, fHasta ?? undefined)
        : [];

    if (fDesde && fHasta && noCias.length > 0) {
      const detalle = await getRevisionPlanillaByDateRange(fDesde, fHasta, noCias, {
        codPlas: codPlas.length > 0 ? codPlas : undefined,
      });

      return ok({
        empresas,
        periodos,
        planillas,
        detalle,
        lastSync,
      });
    }

    return ok({
      empresas,
      periodos,
      planillas,
      lastSync,
    });
  } catch (e) {
    return serverError("Error al consultar revisión de planilla NAF", e);
  }
}
