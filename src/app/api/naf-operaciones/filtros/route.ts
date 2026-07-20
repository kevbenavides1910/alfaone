import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import {
  getCurrentOpCalendarWeek,
  listOpCalendarWeeks,
  listOpCompanies,
  listOpContratos,
  listOpUbicaciones,
} from "@/modules/naf-operaciones/services/op-filters";
import { listOpVacantes } from "@/modules/naf-operaciones/services/list-vacantes";
import { OP_DBA_CHECKLIST, OP_ORACLE_TABLES } from "@/modules/naf-operaciones/business/oracle-map";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "nafOperaciones.roles", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const kind = sp.get("kind") ?? "all";
    const noCiaGrupo = sp.get("noCiaGrupo") ?? undefined;
    const noContrato = sp.get("noContrato") ?? undefined;

    if (kind === "vacantes") {
      if (!hasPermission(session, "nafOperaciones.vacantes", "view")) return forbidden();
      const page = Number.parseInt(sp.get("page") ?? "1", 10);
      const pageSize = Number.parseInt(sp.get("pageSize") ?? "25", 10);
      const semanaPgrRaw = sp.get("semanaPgr");
      return ok(
        await listOpVacantes({
          noCiaGrupo,
          noContrato,
          noUbicacion: sp.get("noUbicacion") ?? undefined,
          semanaPgr:
            semanaPgrRaw != null && semanaPgrRaw !== "" ? Number(semanaPgrRaw) : undefined,
          page: Number.isNaN(page) ? 1 : page,
          pageSize: Number.isNaN(pageSize) ? 25 : pageSize,
        }),
      );
    }

    const [companies, currentWeek, weeks, contratos, ubicaciones] = await Promise.all([
      listOpCompanies(),
      getCurrentOpCalendarWeek(),
      listOpCalendarWeeks(16),
      listOpContratos(noCiaGrupo),
      listOpUbicaciones({ noCiaGrupo, noContrato }),
    ]);

    return ok({
      companies,
      currentWeek,
      weeks,
      contratos,
      ubicaciones,
      oracleTables: OP_ORACLE_TABLES,
      dbaChecklist: OP_DBA_CHECKLIST,
    });
  } catch (e) {
    return serverError("Error al cargar filtros OP", e);
  }
}
