import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { uploadExpedienteDocumento } from "@/modules/expediente-digital";

type Ctx = { params: Promise<{ cedula: string }> };

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest, context: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "expedienteDigital.upload", "edit")) return forbidden();

  try {
    const { cedula: raw } = await context.params;
    const cedula = decodeURIComponent(raw || "").trim();
    if (!cedula) return badRequest("Cédula requerida");

    const form = await req.formData();
    const tipoDoc = String(form.get("tipoDoc") || "").trim();
    const noEmple = String(form.get("noEmple") || "").trim() || null;
    const venceDesde = String(form.get("venceDesde") || "").trim() || null;
    const venceHasta = String(form.get("venceHasta") || "").trim() || null;
    const file = form.get("file");

    if (!tipoDoc) return badRequest("tipoDoc es requerido");
    if (!(file instanceof File)) return badRequest("Archivo PDF requerido");
    if (file.size <= 0) return badRequest("Archivo vacío");
    if (file.size > MAX_BYTES) return badRequest("Archivo mayor a 25 MB");

    const name = file.name || "documento.pdf";
    if (!name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return badRequest("Solo se permiten archivos PDF");
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const actor =
      (session.user as { email?: string | null; name?: string | null } | undefined)
        ?.email ||
      (session.user as { name?: string | null } | undefined)?.name ||
      "ALFAONE";

    const result = await uploadExpedienteDocumento({
      cedulaRaw: cedula,
      tipoDoc,
      fileBuffer: buf,
      fileName: name,
      venceDesde,
      venceHasta,
      noEmple,
      actor: String(actor).slice(0, 100),
    });

    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/no configurado|inválido|no se encontró|no pertenece|no hay código|vigencia/i.test(msg)) {
      return badRequest(msg);
    }
    if (/ORA-01400|VENCE_DESDE/i.test(msg)) {
      return badRequest("Faltan fechas de vigencia requeridas por el tipo de documento");
    }
    return serverError("Error al subir documento al expediente", e);
  }
}
