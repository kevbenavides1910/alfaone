import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { canEditDisciplinaryHistorial } from "@/modules/core/permissions";
import { ok, unauthorized, forbidden, badRequest, notFound, serverError } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import {
  ensureDisciplinarySettingsRow,
  renderMailTemplate,
} from "@/modules/disciplinario/services/disciplinary-settings";
import {
  assertDisciplinarySmtpReady,
  createTransportFromConfig,
} from "@/modules/disciplinario/services/disciplinary-smtp";
import {
  sendDisciplinaryOmisionEmail,
  mergeDisciplinaryCc,
} from "@/modules/disciplinario/services/disciplinary-email";
import { buildOmisionPdfBytes } from "@/modules/disciplinario/services/disciplinary-omision-pdf";
import {
  loadBrandingLogoFile,
  loadDisciplinarySignatureFile,
} from "@/modules/disciplinario/services/disciplinary-pdf-logo";
import { getEmployeesForDisciplinaryByCodes } from "@/modules/disciplinario/services/disciplinary-employee-lookup";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";
import {
  loadZoneDisciplinaryDefaultsMap,
  mergeDefaultsForZoneTexts,
} from "@/modules/disciplinario/services/disciplinary-zone-defaults";

const Schema = z.object({
  codigoEmpleado: z.string().trim().min(1, "El código del empleado es obligatorio"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canEditDisciplinaryHistorial(session)) return forbidden();

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Datos inválidos", parsed.error.flatten());
    }

    const apercibimiento = await prisma.disciplinaryApercibimiento.findUnique({
      where: { id },
      include: {
        omisiones: {
          orderBy: [{ fecha: "asc" }, { hora: "asc" }, { secuencia: "asc" }],
        },
      },
    });
    if (!apercibimiento) return notFound("Apercibimiento no encontrado");

    const codigoNuevo = normalizeEmployeeCode(parsed.data.codigoEmpleado);
    if (!codigoNuevo) {
      return badRequest("El código del empleado es obligatorio");
    }

    const masterMap = await getEmployeesForDisciplinaryByCodes([codigoNuevo]);
    const newMaster = masterMap.get(codigoNuevo);
    if (!newMaster) {
      return badRequest(
        "Empleado no encontrado en el maestro ni en el Directorio NAF. Sincronice NAF o importe empleados.",
      );
    }

    const newNombre = newMaster.nombre?.trim() || `Empleado ${codigoNuevo}`;

    await prisma.disciplinaryApercibimiento.update({
      where: { id },
      data: {
        codigoEmpleado: codigoNuevo,
        codigoEmpleadoRaw: parsed.data.codigoEmpleado.trim(),
        nombreEmpleado: newNombre,
      },
    });

    const smtp = await assertDisciplinarySmtpReady();
    const transport = createTransportFromConfig(smtp);
    const settings = await ensureDisciplinarySettingsRow();
    const [brandingLogoFile, signatureImageFile] = await Promise.all([
      loadBrandingLogoFile(),
      loadDisciplinarySignatureFile(),
    ]);

    const zoneDisciplineDefaults = await loadZoneDisciplinaryDefaultsMap();

    const emailTo = newMaster.email?.trim();

    if (!emailTo) {
      return ok({ updated: true, emailSent: false, reason: "sin_correo" });
    }

    const zd = mergeDefaultsForZoneTexts(
      zoneDisciplineDefaults,
      apercibimiento.zona,
      apercibimiento.zona,
      newMaster.zona ?? null,
    );

    let zoneAdminCc: string | undefined;
    if (zd?.administratorEmail?.trim()) {
      const ccAddr = zd.administratorEmail.trim();
      if (ccAddr.toLowerCase() !== emailTo.toLowerCase()) {
        zoneAdminCc = ccAddr;
      }
    }

    const pdfBytes = await buildOmisionPdfBytes({
      numero: apercibimiento.numero,
      codigoEmpleado: codigoNuevo,
      nombreEmpleado: newNombre,
      fechaEmision: apercibimiento.fechaEmision,
      cedula: newMaster?.cedula?.trim() || null,
      zona: apercibimiento.zona,
      sucursal: apercibimiento.sucursal,
      administrador: apercibimiento.administrador,
      omisiones: apercibimiento.omisiones.map((o) => ({
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

    const safeFile = `Apercibimiento-${apercibimiento.numero.replace(/[^a-zA-Z0-9-_.]/g, "_")}.pdf`;
    const subject = renderMailTemplate(settings.emailSubjectTemplate, {
      numero: apercibimiento.numero,
      nombre: newNombre,
      codigo: codigoNuevo,
      omisiones_count: apercibimiento.omisiones.length,
      zona: apercibimiento.zona,
      administrador: apercibimiento.administrador,
    });
    const text = renderMailTemplate(settings.emailBodyTemplate, {
      numero: apercibimiento.numero,
      nombre: newNombre,
      codigo: codigoNuevo,
      omisiones_count: apercibimiento.omisiones.length,
      zona: apercibimiento.zona,
      administrador: apercibimiento.administrador,
    });

    try {
      await sendDisciplinaryOmisionEmail({
        transport,
        from: smtp.from,
        to: emailTo,
        cc: mergeDisciplinaryCc(emailTo, settings.emailFixedCc, zoneAdminCc),
        subject,
        text,
        pdfFilename: safeFile,
        pdfBytes,
      });
      await prisma.disciplinaryApercibimiento.update({
        where: { id },
        data: { correoEnviadoA: emailTo },
      });
      return ok({ updated: true, emailSent: true });
    } catch (e) {
      return ok({
        updated: true,
        emailSent: false,
        reason: "smtp_error",
        error: e instanceof Error ? e.message : "Error SMTP",
      });
    }
  } catch (e) {
    return serverError(
      e instanceof Error ? e.message : "Error al cambiar responsable",
      e,
    );
  }
}
