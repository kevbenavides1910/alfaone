import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { canImportDisciplinary } from "@/modules/core/permissions";
import { unauthorized, forbidden, badRequest, notFound, serverError } from "@/lib/api/response";
import { buildMarcasPreviewPdfForCodigo } from "@/modules/disciplinario/services/disciplinary-marcas-import";
import { readBoundedUpload } from "@/lib/security/form-upload";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canImportDisciplinary(session)) return forbidden();

  try {
    const form = await req.formData();
    const codigoRaw = form.get("codigo");
    const codigo = typeof codigoRaw === "string" ? codigoRaw.trim() : "";
    if (!codigo) {
      return badRequest("Indique el código de empleado (codigo)");
    }
    const upload = await readBoundedUpload(form);
    if (!upload.ok) return badRequest(upload.message);
    const buffer = upload.buffer;
    const zonaRaw = form.get("zona");
    const sucursalRaw = form.get("sucursal");
    const pdfOptions =
      typeof zonaRaw === "string" || typeof sucursalRaw === "string"
        ? {
            zona: typeof zonaRaw === "string" ? zonaRaw : undefined,
            sucursal: typeof sucursalRaw === "string" ? sucursalRaw : undefined,
          }
        : undefined;
    const pdf = await buildMarcasPreviewPdfForCodigo(buffer, codigo, pdfOptions);
    if (!pdf) {
      return notFound("No hay datos de omisión para ese código en el archivo");
    }
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="vista-previa-apercibimiento-${codigo.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf"`,
      },
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Error al generar PDF", e);
  }
}
