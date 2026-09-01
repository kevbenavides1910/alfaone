import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, forbidden } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { getDisciplinaryDashboard } from "@/modules/disciplinario/services/disciplinary-dashboard";

function parseLocalDate(s: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "disciplinario.dashboard", "view")) return forbidden();

  const sp = req.nextUrl.searchParams;
  const data = await getDisciplinaryDashboard({
    desde: parseLocalDate(sp.get("desde")),
    hasta: parseLocalDate(sp.get("hasta")),
    administrador: sp.get("administrador")?.trim() || undefined,
  });

  return ok(data);
}
