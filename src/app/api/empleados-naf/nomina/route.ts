import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import {
  getNafNominaByDateRange,
  getNafNominaByPeriodo,
  listNafNominaEmpresas,
  listNafNominaPeriodos,
  listNafNominaPlanillas,
} from "@/modules/empleados-naf/services/list-nomina";
import { getLatestNafNominaSyncRun } from "@/modules/empleados-naf/services/sync-nomina";

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
  if (!hasPermission(session, "empleadosNaf.nomina", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const noCias = parseNoCias(sp);
    const anoRaw = sp.get("ano");
    const periodoRaw = sp.get("periodo");
    const fDesde = sp.get("fDesde");
    const fHasta = sp.get("fHasta");
    const codPlas = parseCodPlas(sp);

    const [empresas, lastSync] = await Promise.all([
      listNafNominaEmpresas(),
      getLatestNafNominaSyncRun(),
    ]);

    const periodos = noCias.length > 0 ? await listNafNominaPeriodos(noCias) : [];
    const planillas =
      noCias.length > 0
        ? await listNafNominaPlanillas(noCias, fDesde ?? undefined, fHasta ?? undefined)
        : [];

    if (fDesde && fHasta && noCias.length > 0) {
      const detalle = await getNafNominaByDateRange(fDesde, fHasta, noCias, {
        q: sp.get("q") ?? undefined,
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

    if (anoRaw && periodoRaw && noCias.length > 0) {
      const ano = Number.parseInt(anoRaw, 10);
      const periodo = Number.parseInt(periodoRaw, 10);
      if (Number.isNaN(ano) || Number.isNaN(periodo)) {
        return serverError("Parámetros ano y periodo inválidos");
      }

      const detalle = await getNafNominaByPeriodo(ano, periodo, noCias, {
        q: sp.get("q") ?? undefined,
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
    return serverError("Error al consultar nómina NAF", e);
  }
}
