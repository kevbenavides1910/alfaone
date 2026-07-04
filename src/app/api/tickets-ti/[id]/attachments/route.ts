import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { created, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { saveTicketAttachment } from "@/modules/tickets-ti/services/tickets-attachments";
import { attachmentUploadMetaSchema } from "@/modules/tickets-ti/validations/attachment.schema";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.tickets", "edit")) return forbidden();

  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Archivo requerido");

  const metaParsed = attachmentUploadMetaSchema.safeParse({
    commentId: form.get("commentId") || undefined,
  });
  if (!metaParsed.success) return badRequest("Metadatos inválidos", metaParsed.error.flatten());

  try {
    const row = await saveTicketAttachment(
      session,
      session.user.id,
      id,
      file,
      metaParsed.data.commentId ?? null
    );
    return created(row);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Error al subir archivo");
  }
}
