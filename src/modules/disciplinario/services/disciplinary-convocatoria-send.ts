import { prisma } from "@/modules/core/db/prisma";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";
import {
  loadZoneDisciplinaryDefaultsMap,
  mergeDefaultsForZoneTexts,
} from "@/modules/disciplinario/services/disciplinary-zone-defaults";
import { mergeDisciplinaryCc, sendDisciplinaryOmisionEmail } from "@/modules/disciplinario/services/disciplinary-email";
import {
  assertDisciplinarySmtpReady,
  createTransportFromConfig,
} from "@/modules/disciplinario/services/disciplinary-smtp";
import { ensureDisciplinarySettingsRow } from "@/modules/disciplinario/services/disciplinary-settings";
import { loadBrandingLogoFile, loadDisciplinarySignatureFile } from "@/modules/disciplinario/services/disciplinary-pdf-logo";
import {
  buildConvocatoriaLetterBody,
  buildConvocatoriaPdfBytes,
  formatConvocatoriaHoraTexto,
} from "@/modules/disciplinario/services/disciplinary-convocatoria-pdf";
import { DISCIPLINARY_SIGNER_TITLE } from "@/modules/disciplinario/services/disciplinary-pdf-signature-draw";
import { getEmployeesForDisciplinaryByCodes } from "@/modules/disciplinario/services/disciplinary-employee-lookup";

const HORA_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export function parseHoraConvocatoria(raw: string | null | undefined): string | null {
  const t = raw?.trim() ?? "";
  if (!t) return null;
  const m = t.match(HORA_RE);
  if (!m) return null;
  const [h, min] = t.split(":");
  return `${Number(h)}:${min}`;
}

export function parseLocalDateOnly(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

async function resolveEmployeeContext(codigo: string) {
  const [masterMap, latestAperc, treatment] = await Promise.all([
    getEmployeesForDisciplinaryByCodes([codigo]),
    prisma.disciplinaryApercibimiento.findFirst({
      where: { codigoEmpleado: codigo },
      orderBy: { fechaEmision: "desc" },
      select: { nombreEmpleado: true, zona: true, administrador: true },
    }),
    prisma.disciplinaryTreatment.findUnique({
      where: { codigoEmpleado: codigo },
      select: { nombre: true, zona: true },
    }),
  ]);

  const master = masterMap.get(codigo) ?? null;
  const nombre =
    treatment?.nombre?.trim() ||
    master?.nombre?.trim() ||
    latestAperc?.nombreEmpleado?.trim() ||
    codigo;
  const zona = treatment?.zona?.trim() || master?.zona?.trim() || latestAperc?.zona?.trim() || null;
  const email = master?.email?.trim() || null;

  return { nombre, zona, email, administrador: latestAperc?.administrador?.trim() || null };
}

export async function sendDisciplinaryConvocatoriaEmail(opts: {
  codigo: string;
  fechaConvocatoria: Date;
  horaConvocatoria: string;
  /** Si se envía, actualiza tratamiento antes del correo. */
  accion?: string | null;
}): Promise<{ to: string; cc?: string; nombre: string }> {
  const codigo = normalizeEmployeeCode(opts.codigo);
  if (!codigo) throw new Error("Código de empleado vacío");

  const horaNorm = parseHoraConvocatoria(opts.horaConvocatoria);
  if (!horaNorm) throw new Error("Indique una hora válida (HH:MM, 24 h)");

  const ctx = await resolveEmployeeContext(codigo);
  if (!ctx.email) {
    throw new Error(
      "El empleado no tiene correo en el maestro de empleados (módulo Empleados). Importe o actualice el CSV con la columna de email.",
    );
  }

  const smtp = await assertDisciplinarySmtpReady();
  const transport = createTransportFromConfig(smtp);
  const settings = await ensureDisciplinarySettingsRow();
  const zoneMap = await loadZoneDisciplinaryDefaultsMap();
  const zd = mergeDefaultsForZoneTexts(zoneMap, ctx.zona);
  const zoneAdminCc = zd?.administratorEmail?.trim() || null;
  const cc = mergeDisciplinaryCc(ctx.email, settings.emailFixedCc, zoneAdminCc);
  // Misma resolución de responsable que apercibimientos: registro previo o catálogo de zona.
  const administrador = ctx.administrador?.trim() || zd?.administrator?.trim() || null;

  const horaTexto = formatConvocatoriaHoraTexto(horaNorm);
  const [brandingLogoFile, signatureImageFile] = await Promise.all([
    loadBrandingLogoFile(),
    loadDisciplinarySignatureFile(),
  ]);

  const pdfBytes = await buildConvocatoriaPdfBytes({
    nombreEmpleado: ctx.nombre,
    fechaCarta: new Date(),
    fechaConvocatoria: opts.fechaConvocatoria,
    horaConvocatoriaTexto: horaTexto,
    administrador,
    documentFooter: settings.documentFooter,
    formCode: settings.documentFormCode,
    formRevision: settings.documentFormRevision,
    formVersion: settings.documentFormVersion,
    brandingLogoFile,
    signatureImageFile,
  });

  const cuerpo = buildConvocatoriaLetterBody({
    nombreEmpleado: ctx.nombre,
    fechaConvocatoria: opts.fechaConvocatoria,
    horaConvocatoriaTexto: horaTexto,
  });

  const subject = `Convocatoria a oficinas — ${ctx.nombre}`;
  const responsableBlock = administrador
    ? `${administrador}\n${DISCIPLINARY_SIGNER_TITLE}\n\n`
    : `${DISCIPLINARY_SIGNER_TITLE}\n\n`;
  const text =
    `Estimado/a ${ctx.nombre}:\n\n` +
    `${cuerpo}\n\n` +
    `Atentamente,\n\n` +
    responsableBlock +
    `—\nAdjunto constancia en PDF. Mensaje enviado desde el sistema de control disciplinario.`;

  const safeFile = `Convocatoria-${codigo.replace(/[^a-zA-Z0-9-_.]/g, "_")}.pdf`;

  await sendDisciplinaryOmisionEmail({
    transport,
    from: smtp.from,
    to: ctx.email,
    cc,
    subject,
    text,
    pdfFilename: safeFile,
    pdfBytes,
  });

  await prisma.disciplinaryTreatment.upsert({
    where: { codigoEmpleado: codigo },
    create: {
      codigoEmpleado: codigo,
      codigoEmpleadoRaw: codigo,
      nombre: ctx.nombre,
      zona: ctx.zona,
      fechaConvocatoria: opts.fechaConvocatoria,
      horaConvocatoria: horaNorm,
      accion: opts.accion?.trim() || "Pendiente",
      convocatoriaEnviadaAt: new Date(),
    },
    update: {
      fechaConvocatoria: opts.fechaConvocatoria,
      horaConvocatoria: horaNorm,
      ...(opts.accion !== undefined ? { accion: opts.accion?.trim() || null } : {}),
      convocatoriaEnviadaAt: new Date(),
    },
  });

  return { to: ctx.email, cc, nombre: ctx.nombre };
}
