import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { readTicketAttachment } from "@/modules/tickets-ti";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.attachments", "view")) return forbidden();

  const { id, attachmentId } = await params;

  try {
    const file = await readTicketAttachment(session, session.user.id, id, attachmentId);
    if (!file) return notFound("Archivo no encontrado");
    return new Response(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
      },
    });
  } catch (e) {
    return serverError("Error al descargar archivo", e);
  }
}
