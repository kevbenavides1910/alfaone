import type { EmpleoSnapshot } from "@/modules/solicitudes-rrhh/services/empleo-lookup";
import { getHrDocumentSettings } from "@/modules/solicitudes-rrhh/services/settings";
import { buildCartaFclPdf } from "@/modules/solicitudes-rrhh/services/pdf-carta-fcl";
import { buildCartaServicioPdf } from "@/modules/solicitudes-rrhh/services/pdf-carta-servicio";
import { HR_TRAMITES, type HrTramite } from "@/modules/solicitudes-rrhh/business/tramites";

export async function buildHrDocumentPdf(opts: {
  tramite: HrTramite;
  empleo: EmpleoSnapshot;
  issuedAt?: Date;
}): Promise<{ bytes: Uint8Array; filename: string }> {
  const settings = await getHrDocumentSettings();
  const issuedAt = opts.issuedAt ?? new Date();
  const common = {
    empleo: opts.empleo,
    issuedAt,
    companyLegalName: settings.companyLegalName,
    companyIdNumber: settings.companyIdNumber,
    companyAddress: settings.companyAddress,
    companyPhone: settings.companyPhone,
    signerName: settings.signerName,
    signerTitle: settings.signerTitle,
  };

  if (opts.tramite === HR_TRAMITES.CARTA_FCL) {
    const bytes = await buildCartaFclPdf({
      ...common,
      corporateGroupText: settings.corporateGroupText,
    });
    return { bytes, filename: `carta-fcl-${opts.empleo.cedula}.pdf` };
  }

  const bytes = await buildCartaServicioPdf(common);
  return { bytes, filename: `carta-servicio-${opts.empleo.cedula}.pdf` };
}
