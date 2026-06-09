import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { sendCollectionEmailForFactura } from "@/modules/presupuestos/services/facturacion-cobro-email";

const bodySchema = z.object({
  type: z.enum(["collection", "due_reminder"]).default("collection"),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cxc", "edit")) return forbidden();

  const { id } = await ctx.params;
  let kind: "collection" | "due_reminder" = "collection";
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (parsed.success) kind = parsed.data.type;
  } catch {
    /* body vacío → collection */
  }

  const result = await sendCollectionEmailForFactura(id, kind);
  if (!result.ok) {
    return badRequest(result.message);
  }
  return ok({ sentTo: result.sentTo, cc: result.cc, type: kind });
}
