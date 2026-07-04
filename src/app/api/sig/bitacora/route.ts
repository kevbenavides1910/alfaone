import { NextRequest } from "next/server";
import { SigAuditAction } from "@prisma/client";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listSigBitacora } from "@/modules/sig/services/bitacora";
import { listPendingSigApprovals } from "@/modules/sig/services/documents-list";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const sp = req.nextUrl.searchParams;

  if (sp.get("pending") === "1") {
    if (!hasPermission(session, "sig.aprobaciones", "view")) return forbidden();
    try {
      const result = await listPendingSigApprovals(
        session.user.id,
        sp.get("page") ? Number(sp.get("page")) : 1,
        sp.get("pageSize") ? Number(sp.get("pageSize")) : 25
      );
      return ok({
        ...result,
        rows: result.rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          pendingVersion: r.versions[0]
            ? {
                ...r.versions[0],
                revisionDate: r.versions[0].revisionDate.toISOString(),
                effectiveFrom: r.versions[0].effectiveFrom.toISOString(),
                effectiveUntil: r.versions[0].effectiveUntil?.toISOString() ?? null,
                createdAt: r.versions[0].createdAt.toISOString(),
                downloadUrl: `/api/sig/documents/${r.id}/download?versionId=${r.versions[0].id}`,
              }
            : null,
        })),
      });
    } catch (e) {
      return serverError("Error al listar pendientes", e);
    }
  }

  if (!hasPermission(session, "sig.bitacora", "view")) return forbidden();

  try {
    const actionRaw = sp.get("action");
    const result = await listSigBitacora({
      documentId: sp.get("documentId") ?? undefined,
      actorId: sp.get("actorId") ?? undefined,
      action:
        actionRaw && Object.values(SigAuditAction).includes(actionRaw as SigAuditAction)
          ? (actionRaw as SigAuditAction)
          : undefined,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 30,
    });

    return ok({
      ...result,
      rows: result.rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return serverError("Error al consultar bitácora SIG", e);
  }
}
