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
import { compareSigProcedureVersions } from "@/modules/sig/services/procedure-content";
import { prisma } from "@/modules/core/db/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();

  const { id } = await params;
  const a = req.nextUrl.searchParams.get("a");
  const b = req.nextUrl.searchParams.get("b");
  if (!a || !b) return badRequest("Parámetros a y b (versionId) requeridos");
  if (a === b) return badRequest("Seleccione dos versiones distintas");

  try {
    const [va, vb] = await Promise.all([
      prisma.sigDocumentVersion.findFirst({
        where: { id: a, documentId: id },
        select: { id: true, versionLabel: true, changeSummary: true },
      }),
      prisma.sigDocumentVersion.findFirst({
        where: { id: b, documentId: id },
        select: { id: true, versionLabel: true, changeSummary: true },
      }),
    ]);
    if (!va || !vb) return notFound("Versión no encontrada");

    const data = await compareSigProcedureVersions(id, a, b);
    if (!data) return notFound("No se pudo comparar");

    return ok({
      ...data,
      a: { ...data.a, changeSummary: va.changeSummary },
      b: { ...data.b, changeSummary: vb.changeSummary },
    });
  } catch (e) {
    return serverError("Error al comparar versiones", e);
  }
}
