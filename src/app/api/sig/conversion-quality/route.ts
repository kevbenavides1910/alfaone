import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listSigConversionQualityQueue } from "@/modules/sig/services/conversion-quality";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.documentos", "edit")) return forbidden();

  try {
    const rows = await listSigConversionQualityQueue();
    return ok({ rows, total: rows.length });
  } catch (e) {
    return serverError("Error al listar calidad de conversión", e);
  }
}
