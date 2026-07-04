import { prisma } from "@/modules/core/db/prisma";
import { calculateVigencia } from "@/modules/disciplinario/business/disciplinary";
import {
  decodeSignatureDataUrl,
  saveRecibidoFirmaPng,
} from "./disciplinary-recibido-firma";
import {
  apercibimientoPdfFilename,
  buildApercibimientoPdfBytesForId,
} from "./disciplinary-apercibimiento-pdf-build";
import {
  ensureDisciplinarySettingsRow,
  renderMailTemplate,
} from "./disciplinary-settings";
import { createSmtpTransport, getSmtpConfig } from "./disciplinary-smtp";
import {
  mergeDisciplinaryCc,
  parseEmailAddressList,
  sendDisciplinaryOmisionEmail,
} from "./disciplinary-email";
import { getEmployeesForDisciplinaryByCodes } from "./disciplinary-employee-lookup";
import {
  loadZoneDisciplinaryDefaultsMap,
  mergeDefaultsForZoneTexts,
} from "./disciplinary-zone-defaults";

const SIGNED_SUBJECT_SUFFIX = " (firmado)";
const SIGNED_BODY_PREFIX =
  "Se adjunta el apercibimiento firmado digitalmente por el oficial en constancia de recibido.\n\n";

export type FirmarApercibimientoResult =
  | { ok: true; id: string; numero: string; emailSent: boolean; emailTo: string | null }
  | { ok: false; error: string; status: 400 | 404 | 409 | 502 };

export async function firmarApercibimientoConCorreo(
  apercibimientoId: string,
  signatureDataUrl: string,
): Promise<FirmarApercibimientoResult> {
  const decoded = decodeSignatureDataUrl(signatureDataUrl);
  if (!("length" in decoded)) {
    return { ok: false, error: decoded.error, status: 400 };
  }

  const existing = await prisma.disciplinaryApercibimiento.findUnique({
    where: { id: apercibimientoId },
    select: {
      id: true,
      numero: true,
      codigoEmpleado: true,
      nombreEmpleado: true,
      zona: true,
      administrador: true,
      estado: true,
      fechaEmision: true,
      cantidadOmisiones: true,
    },
  });
  if (!existing) return { ok: false, error: "Apercibimiento no encontrado", status: 404 };
  if (existing.estado === "ANULADO") {
    return { ok: false, error: "No se puede firmar un apercibimiento anulado", status: 409 };
  }

  const { path: firmaPath } = await saveRecibidoFirmaPng(apercibimientoId, decoded);

  await prisma.disciplinaryApercibimiento.update({
    where: { id: apercibimientoId },
    data: {
      firmaRecibidoPath: firmaPath,
      firmaRecibidoAt: new Date(),
      estado: "FIRMADO",
      vigencia: calculateVigencia(existing.fechaEmision, "FIRMADO"),
    },
  });

  const pdfBytes = await buildApercibimientoPdfBytesForId(apercibimientoId);
  if (!pdfBytes) {
    return { ok: false, error: "No se pudo generar el PDF firmado", status: 502 };
  }

  const settings = await ensureDisciplinarySettingsRow();
  const smtpConfig = await getSmtpConfig();
  const transport = await createSmtpTransport();
  if (!smtpConfig || !transport) {
    return {
      ok: true,
      id: existing.id,
      numero: existing.numero,
      emailSent: false,
      emailTo: null,
    };
  }

  const empMap = await getEmployeesForDisciplinaryByCodes([existing.codigoEmpleado]);
  const emp = empMap.get(existing.codigoEmpleado);
  const zoneMap = await loadZoneDisciplinaryDefaultsMap();
  const zoneDefaults = mergeDefaultsForZoneTexts(zoneMap, existing.zona, emp?.zona);
  const zoneAdminEmail = zoneDefaults?.administratorEmail?.trim() || null;
  const oficialEmail = emp?.email?.trim() || null;

  let emailTo: string | null = null;
  let cc: string | undefined;

  if (oficialEmail) {
    emailTo = oficialEmail;
    cc = mergeDisciplinaryCc(oficialEmail, settings.emailFixedCc, zoneAdminEmail);
  } else if (zoneAdminEmail) {
    emailTo = zoneAdminEmail;
    cc = mergeDisciplinaryCc(zoneAdminEmail, settings.emailFixedCc, null);
  } else {
    const fixed = parseEmailAddressList(settings.emailFixedCc);
    if (fixed.length === 0) {
      return {
        ok: true,
        id: existing.id,
        numero: existing.numero,
        emailSent: false,
        emailTo: null,
      };
    }
    emailTo = fixed[0]!;
    cc = fixed.length > 1 ? fixed.slice(1).join(", ") : undefined;
  }

  const templateValues = {
    numero: existing.numero,
    nombre: existing.nombreEmpleado,
    codigo: existing.codigoEmpleado,
    omisiones_count: existing.cantidadOmisiones,
    zona: existing.zona ?? emp?.zona ?? "",
    administrador: existing.administrador ?? zoneDefaults?.administrator ?? "",
  };

  const subject =
    renderMailTemplate(settings.emailSubjectTemplate, templateValues).trim() + SIGNED_SUBJECT_SUFFIX;
  const text =
    SIGNED_BODY_PREFIX + renderMailTemplate(settings.emailBodyTemplate, templateValues);

  try {
    await sendDisciplinaryOmisionEmail({
      transport,
      from: smtpConfig.from,
      to: emailTo,
      cc,
      subject,
      text,
      pdfFilename: apercibimientoPdfFilename(existing.numero),
      pdfBytes,
    });
    await prisma.disciplinaryApercibimiento.update({
      where: { id: apercibimientoId },
      data: {
        correoEnviadoA: emailTo,
        correoFirmadoEnviadoAt: new Date(),
      },
    });
    return {
      ok: true,
      id: existing.id,
      numero: existing.numero,
      emailSent: true,
      emailTo,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error SMTP";
    return { ok: false, error: `Firma guardada pero el correo no se envió: ${msg}`, status: 502 };
  }
}
