import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { canImportDisciplinary } from "@/modules/core/permissions";
import { unauthorized, forbidden, badRequest, ok, serverError } from "@/lib/api/response";
import { sendPendingMarcasBatchEmails } from "@/modules/disciplinario/services/disciplinary-marcas-import";

const bodySchema = z.object({
  maxEmails: z.number().int().min(1).max(25).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canImportDisciplinary(session)) return forbidden();

  try {
    const { id } = await params;
    let maxEmails: number | undefined;
    const raw = await req.text();
    if (raw.trim()) {
      const parsed = bodySchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
      maxEmails = parsed.data.maxEmails;
    }
    const result = await sendPendingMarcasBatchEmails(id, { maxEmails });
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al enviar correos";
    if (msg.includes("SMTP") || msg.includes("Lote no encontrado")) {
      return badRequest(msg);
    }
    return serverError(msg, e);
  }
}
