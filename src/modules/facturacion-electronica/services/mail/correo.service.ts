import fs from "fs/promises";
import type { FeEmpresa } from "@prisma/client";
import { createMailTransport } from "@/lib/email/nodemailer-transport";
import { FeDomainError } from "../../errors/fe-errors";
import { feAbsolutePath } from "../../utils/fe-storage";
import { feSmtpSourceFromEmpresa } from "../../utils/fe-empresa.serializer";
import { resolveFeSmtpConfig } from "./fe-smtp";
import { buildFeComprobanteCcList } from "../../utils/fe-comprobante-correo-cc";

export class FeCorreoService {
  private resolveSmtp(empresa: FeEmpresa, fromOverride?: { email?: string | null; name?: string | null }) {
    const smtp = resolveFeSmtpConfig(feSmtpSourceFromEmpresa(empresa), undefined, {
      email: fromOverride?.email ?? empresa.correoRemitente ?? empresa.email,
      name: fromOverride?.name ?? empresa.correoNombre ?? empresa.nombreComercial,
    });
    if (!smtp) {
      throw new FeDomainError(
        "Configure el servidor SMTP en Facturación electrónica → Configuración emisor → Correo",
        "FE_SMTP_NO_CONFIGURADO"
      );
    }
    if (smtp.user && !smtp.pass) {
      throw new FeDomainError(
        "Falta contraseña SMTP guardada. Guarde la configuración de correo con contraseña.",
        "FE_SMTP_SIN_PASSWORD"
      );
    }
    return smtp;
  }

  async enviarPrueba(params: {
    empresa: FeEmpresa;
    to: string;
    overrides?: Parameters<typeof resolveFeSmtpConfig>[1];
  }) {
    const smtp = resolveFeSmtpConfig(feSmtpSourceFromEmpresa(params.empresa), params.overrides, {
      email: params.overrides?.correoRemitente ?? params.empresa.correoRemitente,
      name: params.overrides?.correoNombre ?? params.empresa.correoNombre,
    });
    if (!smtp) {
      throw new FeDomainError("No hay servidor SMTP configurado", "FE_SMTP_NO_CONFIGURADO");
    }
    if (smtp.user && !smtp.pass) {
      throw new FeDomainError("Falta contraseña SMTP", "FE_SMTP_SIN_PASSWORD");
    }

    const transport = createMailTransport(smtp);
    const to = params.to.trim();
    const cc = buildFeComprobanteCcList(to, params.empresa);
    const info = await transport.sendMail({
      from: smtp.from,
      to,
      cc: cc.length ? cc : undefined,
      subject: "[Prueba] Facturación electrónica — Alfa One",
      text:
        "Este es un correo de prueba del módulo de Facturación electrónica.\n\n" +
        "Si lo recibió, la configuración SMTP es correcta.",
    });
    return { messageId: info.messageId, accepted: info.accepted };
  }

  async enviarComprobante(params: {
    empresa: FeEmpresa;
    destinatario: string;
    destinatariosCopia?: string[];
    remitenteEmail?: string | null;
    remitenteNombre?: string | null;
    asunto: string;
    cuerpo: string;
    xmlPath: string;
    pdfPath: string;
    xmlFileName?: string;
    pdfFileName?: string;
    xmlRespuestaPath?: string | null;
    xmlRespuestaFileName?: string;
  }) {
    const smtp = this.resolveSmtp(params.empresa, {
      email: params.remitenteEmail,
      name: params.remitenteNombre,
    });

    const to = params.destinatario.trim();
    if (!to) {
      throw new FeDomainError("El cliente no tiene correo electrónico", "FE_CLIENTE_SIN_EMAIL");
    }

    const xmlAbs = feAbsolutePath(params.xmlPath);
    const pdfAbs = feAbsolutePath(params.pdfPath);
    const reads = [fs.readFile(xmlAbs), fs.readFile(pdfAbs)] as const;
    const [xmlBuf, pdfBuf] = await Promise.all(reads);

    const attachments: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }> = [
      {
        filename: params.xmlFileName ?? "comprobante.xml",
        content: xmlBuf,
        contentType: "application/xml",
      },
    ];

    if (params.xmlRespuestaPath) {
      const respAbs = feAbsolutePath(params.xmlRespuestaPath);
      const respBuf = await fs.readFile(respAbs);
      attachments.push({
        filename: params.xmlRespuestaFileName ?? "respuesta-hacienda.xml",
        content: respBuf,
        contentType: "application/xml",
      });
    }

    attachments.push({
      filename: params.pdfFileName ?? "comprobante.pdf",
      content: pdfBuf,
      contentType: "application/pdf",
    });

    const transport = createMailTransport(smtp);
    const cc = params.destinatariosCopia?.map((e) => e.trim()).filter(Boolean);

    const info = await transport.sendMail({
      from: smtp.from,
      to,
      cc: cc?.length ? cc : undefined,
      subject: params.asunto,
      text: params.cuerpo,
      attachments,
    });

    return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
  }
}

export const feCorreoService = new FeCorreoService();
