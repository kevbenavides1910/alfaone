import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { listLegalDocumentChangeLogs } from "@/modules/documentos-legales/services/changelog";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withPermission(async (_req: NextRequest, ctx) => {
  try {
    const rows = await listLegalDocumentChangeLogs({ documentId: ctx.params.id, take: 100 });
    return ok(rows);
  } catch (error) {
    return serverError("Error al obtener la bitácora del documento", error);
  }
}, "documentosLegales.calendario") as (req: NextRequest, ctx: Ctx) => Promise<Response>;
