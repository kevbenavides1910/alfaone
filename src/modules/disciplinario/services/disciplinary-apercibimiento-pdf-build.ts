import { prisma } from "@/modules/core/db/prisma";
import { buildOmisionPdfBytes } from "./disciplinary-omision-pdf";
import { ensureDisciplinarySettingsRow } from "./disciplinary-settings";
import { loadBrandingLogoFile, loadDisciplinarySignatureFile } from "./disciplinary-pdf-logo";
import { getEmployeeCedulaForDisciplinary } from "./disciplinary-employee-lookup";
import { loadRecibidoFirmaFile } from "./disciplinary-recibido-firma";

export async function buildApercibimientoPdfBytesForId(apercibimientoId: string): Promise<Uint8Array | null> {
  const row = await prisma.disciplinaryApercibimiento.findUnique({
    where: { id: apercibimientoId },
    include: {
      omisiones: {
        orderBy: [{ fecha: "asc" }, { hora: "asc" }, { secuencia: "asc" }],
      },
    },
  });
  if (!row) return null;

  const settings = await ensureDisciplinarySettingsRow();
  const [brandingLogoFile, signatureImageFile, recibidoSignatureImageFile, cedula] = await Promise.all([
    loadBrandingLogoFile(),
    loadDisciplinarySignatureFile(),
    loadRecibidoFirmaFile(row.firmaRecibidoPath),
    getEmployeeCedulaForDisciplinary(row.codigoEmpleado),
  ]);

  return buildOmisionPdfBytes({
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
    recibidoSignatureImageFile,
    firmaRecibidoAt: row.firmaRecibidoAt,
  });
}

export function apercibimientoPdfFilename(numero: string) {
  return `Apercibimiento-${numero.replace(/[^a-zA-Z0-9-_.]/g, "_")}.pdf`;
}
