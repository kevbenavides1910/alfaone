import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listOpAsistencia } from "@/modules/naf-operaciones/services/list-asistencia-rol";
import { getCurrentOpCalendarWeek } from "@/modules/naf-operaciones/services/op-filters";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "nafOperaciones.asistencia", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const page = Number.parseInt(sp.get("page") ?? "1", 10);
    const pageSize = Number.parseInt(sp.get("pageSize") ?? "25", 10);
    const fecha = sp.get("fecha")?.trim() || undefined;
    const fechaDesde = sp.get("fechaDesde")?.trim() || undefined;
    const fechaHasta = sp.get("fechaHasta")?.trim() || undefined;
    const hasFecha = Boolean(fecha || fechaDesde || fechaHasta);

    let ano = sp.get("ano") != null && sp.get("ano") !== "" ? Number(sp.get("ano")) : undefined;
    let semana =
      sp.get("semana") != null && sp.get("semana") !== "" ? Number(sp.get("semana")) : undefined;

    // Sin fecha: default a semana calendario actual.
    // Con fecha: no forzar ano/semana (salvo que el usuario los mande).
    if (!hasFecha && (ano == null || semana == null)) {
      const current = await getCurrentOpCalendarWeek();
      ano = ano ?? current?.ano;
      semana = semana ?? current?.semana;
    }

    const noRolRaw = sp.get("noRol");
    const result = await listOpAsistencia({
      ano,
      semana,
      fecha,
      fechaDesde,
      fechaHasta,
      noCiaGrupo: sp.get("noCiaGrupo") ?? undefined,
      noContrato: sp.get("noContrato") ?? undefined,
      propietario: sp.get("propietario") ?? undefined,
      nombre: sp.get("nombre") ?? undefined,
      noRol: noRolRaw != null && noRolRaw !== "" ? Number(noRolRaw) : undefined,
      inconsistentesOnly: sp.get("inconsistentesOnly") === "1",
      page: Number.isNaN(page) ? 1 : page,
      pageSize: Number.isNaN(pageSize) ? 25 : pageSize,
    });
    return ok({ ...result, ano, semana, fecha, fechaDesde, fechaHasta });
  } catch (e) {
    return serverError("Error al listar asistencia OP", e);
  }
}
