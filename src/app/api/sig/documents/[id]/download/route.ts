import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { SIG_DOCUMENTS_ROOT } from "@/modules/sig/services/document-uploads";
import { resolveUnderRoot } from "@/lib/security/path-safety";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();

  const { id: documentId } = await params;
  const versionId = req.nextUrl.searchParams.get("versionId");

  try {
    const version = versionId
      ? await prisma.sigDocumentVersion.findFirst({
          where: { id: versionId, documentId },
        })
      : await prisma.sigDocument.findUnique({
          where: { id: documentId },
          select: { currentVersion: true },
        }).then((d) => d?.currentVersion ?? null);

    if (!version) return notFound();

    const abs = resolveUnderRoot(SIG_DOCUMENTS_ROOT, version.storagePath);
    if (!abs) return notFound();

    const buf = await readFile(abs).catch(() => null);
    if (!buf) return notFound();

    const inline =
      req.nextUrl.searchParams.get("inline") === "1" &&
      (version.mimeType.startsWith("image/") || version.mimeType === "application/pdf");

    return new Response(buf, {
      headers: {
        "Content-Type": version.mimeType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(version.fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return serverError("Error al descargar documento", e);
  }
}
