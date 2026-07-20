import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listPhotorecReviewItems } from "@/modules/empleados/services/photorec-review";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const folder = sp.get("folder")?.trim() || undefined;
    const onlyPending = sp.get("onlyPending") === "1";
    const onlySuggested = sp.get("onlySuggested") === "1";
    const minRaw = sp.get("minConfidence")?.trim().toLowerCase();
    const minConfidence =
      minRaw === "alta" || minRaw === "media" || minRaw === "baja" ? minRaw : undefined;
    const kindRaw = sp.get("suggestionKind")?.trim().toLowerCase();
    const suggestionKind =
      kindRaw === "missing_e5" || kindRaw === "probable_duplicate" || kindRaw === "all"
        ? kindRaw
        : undefined;
    const result = await listPhotorecReviewItems({
      folder,
      onlyPending,
      onlySuggested,
      minConfidence,
      suggestionKind,
    });
    return ok(result);
  } catch (e) {
    return serverError("Error al listar PDFs PhotoRec", e);
  }
}
