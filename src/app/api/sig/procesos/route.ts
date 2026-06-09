import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError, created } from "@/lib/api/response";
import { listSigProcesses, createSigProcess } from "@/modules/sig/services/catalogs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (
    !hasPermission(session, "sig.procesos", "view") &&
    !hasPermission(session, "sig.biblioteca", "view")
  ) {
    return forbidden();
  }

  try {
    const includeInactive = req.nextUrl.searchParams.get("all") === "1";
    const rows = await listSigProcesses(includeInactive);
    return ok(
      rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))
    );
  } catch (e) {
    return serverError("Error al listar procesos", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.procesos", "edit")) return forbidden();

  try {
    const body = await req.json();
    if (typeof body.code !== "string" || !body.code.trim()) return badRequest("Código requerido");
    if (typeof body.name !== "string" || !body.name.trim()) return badRequest("Nombre requerido");

    const row = await createSigProcess({
      code: body.code,
      name: body.name,
      description: typeof body.description === "string" ? body.description : null,
      parentId: typeof body.parentId === "string" ? body.parentId : null,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    });

    return created({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
    return serverError("Error al crear proceso", e);
  }
}
