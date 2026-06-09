import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { canViewDisciplinary } from "@/modules/core/permissions";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import { buildOmisionPdfBytes } from "@/modules/disciplinario/services/disciplinary-omision-pdf";
import { ensureDisciplinarySettingsRow } from "@/modules/disciplinario/services/disciplinary-settings";
import { loadBrandingLogoFile, loadDisciplinarySignatureFile } from "@/modules/disciplinario/services/disciplinary-pdf-logo";
import { getEmployeeCedulaForDisciplinary } from "@/modules/disciplinario/services/disciplinary-employee-lookup";

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
      include: {
        omisiones: {
          orderBy: [{ fecha: "asc" }, { hora: "asc" }, { secuencia: "asc" }],
        },
      },
    });
    if (!row) return notFound("Apercibimiento no encontrado");

    const settings = await ensureDisciplinarySettingsRow();
    const [brandingLogoFile, signatureImageFile] = await Promise.all([
      loadBrandingLogoFile(),
      loadDisciplinarySignatureFile(),
    ]);
    const cedula = await getEmployeeCedulaForDisciplinary(row.codigoEmpleado);

    const pdfBytes = await buildOmisionPdfBytes({
      numero: row.numero,
      codigoEmpleado: row.codigoEmpleado,
      nombreEmpleado: row.nombreEmpleado,
      fechaEmision: row.fechaEmision,
      cedula,
      zona: row.zona,
      sucursal: row.sucursal,
      administrador: row.administrador,
      omisiones: row.omisiones.map((o) => ({
        fecha: o.fecha,
        hora: o.hora,
        puntoOmitido: o.puntoOmitido,
      })),
      documentTitle: settings.documentTitle,
      documentLegalText: settings.documentLegalText,
      documentIntroTemplate: settings.documentIntroTemplate,
      documentFooter: settings.documentFooter,
      formCode: settings.documentFormCode,
      formRevision: settings.documentFormRevision,
      formVersion: settings.documentFormVersion,
      formSubtitle: settings.documentFormSubtitle,
      brandingLogoFile,
      signatureImageFile,
    });

    const filename = `Apercibimiento-${row.numero.replace(/[^a-zA-Z0-9-_.]/g, "_")}.pdf`;
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
