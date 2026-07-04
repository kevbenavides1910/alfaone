import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { canImportDisciplinary } from "@/modules/core/permissions";
import { unauthorized, forbidden, badRequest, created, serverError } from "@/lib/api/response";
import {
  importDisciplinaryWorkbook,
  DuplicateImportError,
} from "@/modules/disciplinario/services/disciplinary-import";
import { readBoundedUpload } from "@/lib/security/form-upload";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canImportDisciplinary(session)) return forbidden();

  try {
    const form = await req.formData();
    const upload = await readBoundedUpload(form);
    if (!upload.ok) return badRequest(upload.message);

    const result = await importDisciplinaryWorkbook(
      upload.buffer,
      upload.fileName,
      session.user.id,
    );
    return created(result);
  } catch (e) {
    if (e instanceof DuplicateImportError) {
      // 409: archivo ya procesado. Devolvemos los datos del batch previo para que la
      // UI muestre un mensaje claro al usuario.
      return NextResponse.json(
        {
          error: {
            code: "DUPLICATE_IMPORT",
            message:
              "Este archivo ya fue importado anteriormente. No se procesó de nuevo para evitar duplicados.",
            previousBatch: {
              id: e.previousBatch.id,
              filename: e.previousBatch.filename,
              createdAt: e.previousBatch.createdAt.toISOString(),
              uploadedByName: e.previousBatch.uploadedByName,
            },
          },
        },
        { status: 409 },
      );
    }
    return serverError(
      e instanceof Error ? e.message : "Error al importar el Excel disciplinario",
      e,
    );
  }
}
