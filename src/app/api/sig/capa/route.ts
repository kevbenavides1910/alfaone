import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getCapaEfficacyDashboard } from "@/modules/sig/services/capa-dashboard";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.auditorias", "view")) return forbidden();

  try {
    const year = Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear());
    const processId = req.nextUrl.searchParams.get("processId") ?? undefined;
    const data = await getCapaEfficacyDashboard({
      year: Number.isFinite(year) ? year : new Date().getFullYear(),
      processId,
    });
    return ok({
      ...data,
      findings: {
        ...data.findings,
        openRows: data.findings.openRows.map((f) => ({
          ...f,
          createdAt: f.createdAt.toISOString(),
        })),
      },
      actions: {
        ...data.actions,
        overdueRows: data.actions.overdueRows.map((a) => ({
          ...a,
          dueDate: a.dueDate?.toISOString() ?? null,
        })),
      },
    });
  } catch (e) {
    return serverError("Error al cargar tablero CAPA", e);
  }
}
