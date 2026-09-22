import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getSigBandeja } from "@/modules/sig/services/bandeja";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (
    !hasPermission(session, "sig.aprobaciones", "view") &&
    !hasPermission(session, "sig.biblioteca", "view")
  ) {
    return forbidden();
  }

  try {
    const withinDays = Number(req.nextUrl.searchParams.get("withinDays") ?? 30);
    const data = await getSigBandeja(
      session.user.id,
      Number.isFinite(withinDays) ? withinDays : 30
    );

    return ok({
      approvals: {
        ...data.approvals,
        rows: data.approvals.rows.map((r) => ({
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
      },
      changeRequests: {
        ...data.changeRequests,
        rows: data.changeRequests.rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
        })),
      },
      revisions: data.revisions,
    });
  } catch (e) {
    return serverError("Error al cargar bandeja SIG", e);
  }
}
