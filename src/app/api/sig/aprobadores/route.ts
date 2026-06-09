import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listSigApprovers } from "@/modules/sig/services/approvers";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (
    !hasPermission(session, "sig.documentos", "view") &&
    !hasPermission(session, "sig.aprobaciones", "view")
  ) {
    return forbidden();
  }

  try {
    const rows = await listSigApprovers();
    return ok(rows);
  } catch (e) {
    return serverError("Error al listar aprobadores SIG", e);
  }
}
