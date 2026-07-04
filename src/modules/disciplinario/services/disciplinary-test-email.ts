import { buildOmisionPdfBytes } from "@/modules/disciplinario/services/disciplinary-omision-pdf";
import { loadBrandingLogoFile, loadDisciplinarySignatureFile } from "@/modules/disciplinario/services/disciplinary-pdf-logo";
import {
  ensureDisciplinarySettingsRow,
  renderMailTemplate,
  type MailTemplateValues,
} from "@/modules/disciplinario/services/disciplinary-settings";

export const DISCIPLINARY_TEST_SAMPLE: MailTemplateValues & {
  numero: string;
  nombre: string;
  codigo: string;
  cedula: string;
  zona: string;
  administrador: string;
  omisiones_count: number;
} = {
  numero: "OM-2026-000000",
  nombre: "Empleado de prueba",
  codigo: "00001",
  cedula: "1-2345-6789",
  zona: "Zona ejemplo",
  administrador: "Administrador ejemplo",
  omisiones_count: 2,
};

function sampleOmisiones(): { fecha: Date; hora: string; puntoOmitido: string }[] {
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  const d1 = new Date(base);
  d1.setDate(d1.getDate() - 3);
  const d2 = new Date(base);
  d2.setDate(d2.getDate() - 1);
  return [
    { fecha: d1, hora: "08:30", puntoOmitido: "Entrada principal" },
    { fecha: d2, hora: "14:00", puntoOmitido: "Ronda vespertina" },
  ];
}

export async function buildDisciplinaryTestPdfBytes(
  settings: Awaited<ReturnType<typeof ensureDisciplinarySettingsRow>>,
): Promise<Uint8Array> {
  const [brandingLogoFile, signatureImageFile] = await Promise.all([
    loadBrandingLogoFile(),
    loadDisciplinarySignatureFile(),
  ]);
  const omisiones = sampleOmisiones();

  return buildOmisionPdfBytes({
    numero: DISCIPLINARY_TEST_SAMPLE.numero,
    codigoEmpleado: DISCIPLINARY_TEST_SAMPLE.codigo,
    nombreEmpleado: DISCIPLINARY_TEST_SAMPLE.nombre,
    fechaEmision: new Date(),
    cedula: DISCIPLINARY_TEST_SAMPLE.cedula,
    zona: DISCIPLINARY_TEST_SAMPLE.zona,
    sucursal: "Sucursal ejemplo",
    administrador: DISCIPLINARY_TEST_SAMPLE.administrador,
    omisiones,
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
}

export function buildDisciplinaryTestEmailContent(
  settings: Awaited<ReturnType<typeof ensureDisciplinarySettingsRow>>,
  overrides?: { emailSubjectTemplate?: string | null; emailBodyTemplate?: string | null },
): { subject: string; text: string; pdfFilename: string } {
  const subjectTpl = overrides?.emailSubjectTemplate?.trim() || settings.emailSubjectTemplate;
  const bodyTpl = overrides?.emailBodyTemplate?.trim() || settings.emailBodyTemplate;
  const values = DISCIPLINARY_TEST_SAMPLE;

  const subject = `[PRUEBA] ${renderMailTemplate(subjectTpl, values)}`.trim();
  const renderedBody = renderMailTemplate(bodyTpl, values);
  const text =
    `${renderedBody}\n\n` +
    "—\n" +
    "Este es un envío de prueba desde la configuración de Disciplinario. " +
    "El PDF adjunto usa datos de ejemplo y el formato definido en Ajustes → Documento " +
    "(título, intro, pie legal, código de formulario, logo y firma).";

  const safeFile = `Apercibimiento-PRUEBA-${DISCIPLINARY_TEST_SAMPLE.numero.replace(/[^a-zA-Z0-9-_.]/g, "_")}.pdf`;

  return { subject, text, pdfFilename: safeFile };
}
