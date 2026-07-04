import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { badRequest, forbidden, notFound, unauthorized } from "@/lib/api/response";
import { resolveNafDocumentPdf } from "@/modules/naf-documentos/services/resolve-naf-document-pdf";
import { nafDocumentoPdfSchema } from "@/modules/presupuestos/validations/naf-documentos.schema";

function canViewDocumentosNaf(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return hasPermission(session, "facturacion.documentos_naf", "view");
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canViewDocumentosNaf(session)) return forbidden();

  const { searchParams } = new URL(req.url);
  const parsed = nafDocumentoPdfSchema.safeParse({
    noCia: searchParams.get("noCia"),
    tipoDoc: searchParams.get("tipoDoc"),
    noFactu: searchParams.get("noFactu"),
    companyCode: searchParams.get("companyCode") ?? undefined,
    claveFactura: searchParams.get("claveFactura") ?? undefined,
    consecutivoFe: searchParams.get("consecutivoFe") ?? undefined,
  });

  if (!parsed.success) {
    return badRequest("Parámetros inválidos", parsed.error.flatten());
  }

  const inline = searchParams.get("inline") === "1";
  const file = await resolveNafDocumentPdf({
    noCia: parsed.data.noCia,
    companyCode: parsed.data.companyCode ?? null,
    tipoDoc: parsed.data.tipoDoc,
    noFactu: parsed.data.noFactu,
    claveFactura: parsed.data.claveFactura ?? null,
    consecutivoFe: parsed.data.consecutivoFe ?? null,
  });

  if (!file) {
    return notFound(
      "No se encontró el PDF del documento. Verifique que exista en facturación electrónica o en el repositorio NAF.",
    );
  }

  return new Response(new Uint8Array(file.buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.fileName)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
