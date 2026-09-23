import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api/response";
import { locateStandardClausePage } from "@/modules/sig/services/standard-pdf-locator";

type Ctx = { params: Promise<{ id: string }> };

function canView(session: Parameters<typeof hasPermission>[0]) {
  return (
    hasPermission(session, "sig.requisitos", "view") ||
    hasPermission(session, "sig.biblioteca", "view") ||
    hasPermission(session, "sig.auditorias", "view")
  );
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canView(session)) return forbidden();

  try {
    const { id } = await params;
    const clause = (req.nextUrl.searchParams.get("clause") ?? "").trim();
    const title = req.nextUrl.searchParams.get("title");
    if (!clause) return badRequest("Indique clause (ej. 4.1)");
    if (!/^\d+(?:\.\d+)*$/.test(clause)) return badRequest("Código de cláusula inválido");

    const result = await locateStandardClausePage(id, clause, title);
    if (result.pageCount === 0) {
      return notFound("No hay PDF de esta norma o no se pudo leer");
    }
    return ok({
      clause,
      page: result.page,
      pageCount: result.pageCount,
      found: result.page != null,
    });
  } catch (e) {
    return serverError("Error localizando cláusula en el PDF", e);
  }
}
