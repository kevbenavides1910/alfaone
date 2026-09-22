import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api/response";
import { reindexSigDocumentVersion } from "@/modules/sig/services/conversion-quality";
import { prisma } from "@/modules/core/db/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** Reindexa la versión vigente (o versionId) y convierte Alfa si aplica. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.documentos", "edit")) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    let versionId =
      typeof body?.versionId === "string" ? body.versionId : null;

    if (!versionId) {
      const doc = await prisma.sigDocument.findUnique({
        where: { id },
        select: { currentVersionId: true },
      });
      versionId = doc?.currentVersionId ?? null;
    } else {
      const v = await prisma.sigDocumentVersion.findFirst({
        where: { id: versionId, documentId: id },
        select: { id: true },
      });
      if (!v) return badRequest("versionId no pertenece al documento");
    }

    if (!versionId) return notFound("Documento sin versión");

    const result = await reindexSigDocumentVersion(versionId);
    return ok({
      ...result,
      version: result.version
        ? {
            ...result.version,
            textIndexedAt: result.version.textIndexedAt?.toISOString() ?? null,
          }
        : null,
    });
  } catch (e) {
    return serverError("Error al reindexar documento", e);
  }
}
