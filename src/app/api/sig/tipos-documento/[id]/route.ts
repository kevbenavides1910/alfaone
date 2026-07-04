import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, notFound, noContent, serverError } from "@/lib/api/response";
import { updateSigDocumentType, deleteSigDocumentType } from "@/modules/sig/services/catalogs";

type Ctx = { params: Promise<{ id: string }> };

function clientError(e: unknown) {
  const msg = e instanceof Error ? e.message : "Error";
  if (
    msg.includes("no encontrado") ||
    msg.includes("Ya existe") ||
    msg.includes("No se puede eliminar") ||
    msg.includes("Código requerido")
  ) {
    return badRequest(msg);
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.procesos", "admin")) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json();
    const row = await updateSigDocumentType(id, {
      code: typeof body.code === "string" ? body.code : undefined,
      name: typeof body.name === "string" ? body.name : undefined,
      description: body.description !== undefined ? body.description : undefined,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });

    return ok({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
    const err = clientError(e);
    if (err) return err;
    return serverError("Error al actualizar tipo documental", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.procesos", "admin")) return forbidden();

  const { id } = await params;
  try {
    await deleteSigDocumentType(id);
    return noContent();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("no encontrado")) return notFound(msg);
    const err = clientError(e);
    if (err) return err;
    return serverError("Error al eliminar tipo documental", e);
  }
}
