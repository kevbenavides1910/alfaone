import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { bulkCreateSigDocuments } from "@/modules/sig/services/documents-bulk-import";
import {
  detectMimeFromBuffer,
  mimeMatchesDeclared,
} from "@/lib/security/file-validation";
import { ALLOWED_SIG_DOCUMENT_MIMES, MAX_SIG_DOCUMENT_BYTES } from "@/modules/sig/services/document-uploads";

const metadataSchema = z.object({
  documentTypeId: z.string().min(1, "Tipo documental requerido"),
  processId: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  revisionIntervalDays: z.number().int().positive().optional().nullable(),
  changeSummary: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        code: z.string().min(1, "Código requerido"),
        title: z.string().min(1, "Título requerido"),
        versionLabel: z.string().min(1, "Versión requerida").max(40).optional(),
      }),
    )
    .min(1, "Debe incluir al menos un documento")
    .max(50, "Máximo 50 documentos por carga"),
});

async function readValidatedFile(blob: File) {
  if (blob.size > MAX_SIG_DOCUMENT_BYTES) {
    throw new Error(`${blob.name}: archivo demasiado grande (máximo 50 MB)`);
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const detected = detectMimeFromBuffer(buf);
  const declared = blob.type || "application/octet-stream";

  if (!ALLOWED_SIG_DOCUMENT_MIMES.has(declared)) {
    throw new Error(`${blob.name}: tipo de archivo no permitido`);
  }
  if (!mimeMatchesDeclared(detected, declared)) {
    throw new Error(`${blob.name}: el contenido no coincide con el tipo declarado`);
  }

  const mime = detected !== "application/octet-stream" ? detected : declared;

  return {
    buffer: buf,
    fileName: blob.name || "documento",
    mimeType: mime,
    size: blob.size,
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.documentos", "edit")) return forbidden();

  try {
    const form = await req.formData();
    const metadataRaw = form.get("metadata");
    if (typeof metadataRaw !== "string" || !metadataRaw.trim()) {
      return badRequest("Metadatos de carga requeridos");
    }

    let metadataJson: unknown;
    try {
      metadataJson = JSON.parse(metadataRaw);
    } catch {
      return badRequest("Metadatos inválidos (JSON)");
    }

    const parsed = metadataSchema.safeParse(metadataJson);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const msg = Object.values(flat.fieldErrors).flat()[0] ?? flat.formErrors[0] ?? "Datos inválidos";
      return badRequest(msg, flat);
    }

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) return badRequest("Debe adjuntar al menos un archivo");
    if (files.length !== parsed.data.items.length) {
      return badRequest("La cantidad de archivos no coincide con la lista de documentos");
    }

    const items = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const file = await readValidatedFile(files[i]);
        items.push({
          code: parsed.data.items[i].code,
          title: parsed.data.items[i].title,
          versionLabel: parsed.data.items[i].versionLabel?.trim() || "1",
          file,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Archivo inválido";
        return badRequest(msg);
      }
    }

    const result = await bulkCreateSigDocuments(
      {
        documentTypeId: parsed.data.documentTypeId,
        processId: parsed.data.processId ?? null,
        company: parsed.data.company ?? null,
        revisionIntervalDays: parsed.data.revisionIntervalDays ?? null,
        changeSummary: parsed.data.changeSummary ?? null,
      },
      items,
      session.user.id,
    );

    return ok(result);
  } catch (e) {
    return serverError("Error en carga masiva SIG", e);
  }
}
