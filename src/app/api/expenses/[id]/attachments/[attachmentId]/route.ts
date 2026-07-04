import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { canViewExpenseDetail } from "@/modules/presupuestos/services/expense-approval";
import { EXPENSE_UPLOAD_ROOT } from "@/modules/presupuestos/services/expense-uploads";
import { resolveUnderRoot } from "@/lib/security/path-safety";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: expenseId, attachmentId } = await params;
  try {
    const att = await prisma.expenseAttachment.findFirst({
      where: { id: attachmentId, expenseId },
    });
    if (!att) return notFound();

    const can = await canViewExpenseDetail(session, expenseId);
    if (!can) return forbidden();

    const abs = resolveUnderRoot(EXPENSE_UPLOAD_ROOT, att.storagePath);
    if (!abs) return notFound();
    const buf = await readFile(abs).catch(() => null);
    if (!buf) return notFound();

    const safeInline =
      req.nextUrl.searchParams.get("inline") === "1" &&
      (att.mimeType.startsWith("image/") || att.mimeType === "application/pdf");
    const disposition = safeInline ? "inline" : "attachment";

    return new Response(buf, {
      headers: {
        "Content-Type": att.mimeType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(att.fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return serverError("Error al descargar adjunto", e);
  }
}
