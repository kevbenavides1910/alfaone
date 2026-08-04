import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { apiHandler } from "@/lib/api/handler";
import { badRequest, notFound, ok } from "@/lib/api/response";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import {
  getSigEvidenceDetail,
  linkSigEvidence,
  SIG_EVIDENCE_ROOT,
  updateSigEvidence,
} from "@/modules/sig";
import { linkEvidenceSchema, updateEvidenceSchema } from "@/modules/sig/validations/evidences.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const GET = apiHandler(
  { permission: ["sig.evidencias", "view"], errorLabel: "Error consultando evidencia SIG" },
  async ({ req, params }) => {
    const id = paramId(await params);
    const download = req.nextUrl.searchParams.get("download") === "1";
    const row = await getSigEvidenceDetail(id);
    if (!row) return notFound("Evidencia no encontrada");

    if (download) {
      if (!row.storagePath) return badRequest("La evidencia no tiene archivo adjunto");
      const absolute = resolveUnderRoot(SIG_EVIDENCE_ROOT, row.storagePath);
      if (!absolute) return badRequest("Ruta de archivo inválida");
      const info = await stat(absolute);
      const stream = createReadStream(absolute);
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        headers: {
          "Content-Type": row.mimeType || "application/octet-stream",
          "Content-Length": String(info.size),
          "Content-Disposition": `attachment; filename="${encodeURIComponent(row.fileName || row.code)}"`,
        },
      });
    }

    return ok(row);
  }
);

export const PATCH = apiHandler(
  { permission: ["sig.evidencias", "edit"], errorLabel: "Error actualizando evidencia SIG" },
  async ({ req, params }) => {
    const parsed = updateEvidenceSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de evidencia inválidos", parsed.error.flatten());
    return ok(await updateSigEvidence(paramId(await params), parsed.data));
  }
);

export const POST = apiHandler(
  { permission: ["sig.evidencias", "edit"], errorLabel: "Error vinculando evidencia SIG" },
  async ({ req, params }) => {
    const parsed = linkEvidenceSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de vínculo inválidos", parsed.error.flatten());
    return ok(await linkSigEvidence(paramId(await params), parsed.data));
  }
);
