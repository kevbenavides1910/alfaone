import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  deleteNominaManualAllocation,
  listNominaSinAsignar,
  listNafNominaEmpresas,
  listNafNominaPeriodos,
  saveNominaManualAllocation,
} from "@/modules/empleados-naf/services/nomina-sin-asignar";

function parseNoCias(sp: URLSearchParams): string[] {
  const repeated = sp.getAll("noCia").flatMap((value) => value.split(","));
  const csv = sp.get("noCias");
  const values = csv ? [...repeated, ...csv.split(",")] : repeated;
  return values.map((value) => value.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.sinAsignar", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const noCias = parseNoCias(sp);
    const fDesde = sp.get("fDesde");
    const fHasta = sp.get("fHasta");

    const [empresas, periodos] = await Promise.all([
      listNafNominaEmpresas(),
      noCias.length > 0 ? listNafNominaPeriodos(noCias) : Promise.resolve([]),
    ]);

    if (!fDesde || !fHasta || noCias.length === 0) {
      return ok({ empresas, periodos });
    }

    const data = await listNominaSinAsignar({
      fDesde,
      fHasta,
      noCias,
      q: sp.get("q") ?? undefined,
    });

    return ok({ empresas, periodos, ...data });
  } catch (e) {
    return serverError(
      e instanceof Error ? e.message : "Error al consultar nómina sin asignar",
      e,
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.sinAsignar", "edit")) return forbidden();

  try {
    const body = (await req.json()) as {
      action?: string;
      noCia?: string;
      noEmple?: string;
      fDesde?: string;
      fHasta?: string;
      codPla?: string;
      lines?: Array<{ contractId: string; devengado: number }>;
      notes?: string;
    };

    const noCia = body.noCia?.trim();
    const noEmple = body.noEmple?.trim();
    const fDesde = body.fDesde?.trim();
    const fHasta = body.fHasta?.trim();
    const codPla = body.codPla?.trim();

    if (!noCia || !noEmple || !fDesde || !fHasta || !codPla) {
      return badRequest("Indique noCia, noEmple, fDesde, fHasta y codPla");
    }

    if (body.action === "delete") {
      const result = await deleteNominaManualAllocation({
        noCia,
        noEmple,
        fDesde,
        fHasta,
        codPla,
      });
      return ok(result);
    }

    const lines = body.lines?.filter((line) => line.contractId?.trim()) ?? [];
    if (lines.length === 0) {
      return badRequest("Indique al menos un contrato con devengado");
    }

    const result = await saveNominaManualAllocation({
      noCia,
      noEmple,
      fDesde,
      fHasta,
      codPla,
      lines: lines.map((line) => ({
        contractId: line.contractId.trim(),
        devengado: Number(line.devengado),
      })),
      notes: body.notes,
      createdById: session.user.id,
    });

    return ok(result);
  } catch (e) {
    return serverError(
      e instanceof Error ? e.message : "Error al guardar asignación manual",
      e,
    );
  }
}
