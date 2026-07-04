import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { canViewDisciplinary } from "@/modules/core/permissions";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import {
  apercibimientoPdfFilename,
  buildApercibimientoPdfBytesForId,
} from "@/modules/disciplinario/services/disciplinary-apercibimiento-pdf-build";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canViewDisciplinary(session)) return forbidden();

  try {
    const { id } = await params;
    const row = await prisma.disciplinaryApercibimiento.findUnique({
      where: { id },
      select: { numero: true },
    });
    if (!row) return notFound("Apercibimiento no encontrado");

    const pdfBytes = await buildApercibimientoPdfBytesForId(id);
    if (!pdfBytes) return notFound("Apercibimiento no encontrado");

    const filename = apercibimientoPdfFilename(row.numero);
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Error al generar PDF", e);
  }
}
