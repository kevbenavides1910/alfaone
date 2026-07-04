import { writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { ImapFlow } from "imapflow";
import { simpleParser, type Attachment } from "mailparser";
import type { PrismaClient } from "@prisma/client";
import { FeDomainError } from "../../errors/fe-errors";
import { FeEmpresaRepository } from "../../repositories/fe-empresa.repository";
import { FeComprobanteRecibidoRepository } from "../../repositories/fe-comprobante-recibido.repository";
import { FeProveedorConfianzaRepository } from "../../repositories/fe-proveedor-confianza.repository";
import { FeComprobanteRecibidoService } from "../comprobante-recibido.service";
import { resolveFeImapConfig } from "../mail/fe-imap";
import {
  ensureFeDir,
  feAbsolutePath,
  feRecibidosDir,
  feRelativePath,
} from "../../utils/fe-storage";
import { feLogger } from "../../utils/logger";
import type { FeFacturaRecibidaParsed } from "./factura-recibida.parser";
import {
  isFeComprobanteXml,
  isValidFeClave,
  parseFacturaRecibidaXml,
} from "./factura-recibida.parser";
import { isComprobanteRecibidoValido } from "../../utils/fe-recibido-validacion";
import { notDeleted } from "../../utils/soft-delete";
import type { TestFeImapInput } from "../../validators/imap.schema";

type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export class FeIncomingMailService {
  private readonly empresaRepo: FeEmpresaRepository;
  private readonly recibidoRepo: FeComprobanteRecibidoRepository;
  private readonly proveedorRepo: FeProveedorConfianzaRepository;
  private readonly recibidoService: FeComprobanteRecibidoService;

  constructor(private readonly prisma: PrismaClient) {
    this.empresaRepo = new FeEmpresaRepository(prisma);
    this.recibidoRepo = new FeComprobanteRecibidoRepository(prisma);
    this.proveedorRepo = new FeProveedorConfianzaRepository(prisma);
    this.recibidoService = new FeComprobanteRecibidoService(prisma);
  }

  async testConnection(input: TestFeImapInput) {
    const client = this.createClient(input);
    try {
      await client.connect();
      const lock = await client.getMailboxLock(input.imapFolder);
      try {
        const status = await client.status(input.imapFolder, { messages: true, unseen: true });
        return {
          ok: true as const,
          messages: status.messages ?? 0,
          unseen: status.unseen ?? 0,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  async pollAllEmpresas() {
    const empresas = await this.prisma.feEmpresa.findMany({
      where: { imapEnabled: true, isActive: true, ...notDeleted },
    });
    const results = [];
    for (const empresa of empresas) {
      try {
        const summary = await this.pollEmpresa(empresa.companyCode);
        results.push({ companyCode: empresa.companyCode, ...summary });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        feLogger.error("IMAP poll fallido", { companyCode: empresa.companyCode, error: message });
        results.push({ companyCode: empresa.companyCode, error: message, processed: 0, skipped: 0 });
      }
    }
    return results;
  }

  async pollEmpresa(companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const config = resolveFeImapConfig(empresa);
    if (!config) {
      throw new FeDomainError("IMAP no configurado para esta empresa", "FE_IMAP_NOT_CONFIGURED", 400);
    }

    const client = this.createClient({
      imapHost: config.host,
      imapPort: config.port,
      imapSecure: config.secure,
      imapUser: config.user,
      imapPass: config.pass,
      imapFolder: config.folder,
    });

    let processed = 0;
    let skipped = 0;
    let lastUid = empresa.imapLastUid ?? 0;
    const maxPerRun = 20;
    let scanned = 0;

    try {
      await client.connect();
      const lock = await client.getMailboxLock(config.folder);
      try {
        let query: { uid: string } | { seen: false };
        if (lastUid > 0) {
          query = { uid: `${lastUid + 1}:*` };
        } else {
          const status = await client.status(config.folder, { uidNext: true });
          const uidNext = status.uidNext ?? 1;
          const startUid = Math.max(1, uidNext - 30);
          query = { uid: `${startUid}:*` };
          feLogger.info("IMAP primera sincronización — últimos UIDs", {
            companyCode,
            startUid,
            uidNext,
          });
        }

        for await (const msg of client.fetch(query, { uid: true, source: true, envelope: true })) {
          if (scanned >= maxPerRun) break;
          if (!msg.source || !msg.uid) continue;
          scanned += 1;
          if (msg.uid <= lastUid) {
            skipped += 1;
            continue;
          }

          const parsed = await simpleParser(msg.source);
          const messageId = parsed.messageId?.trim() || `uid-${msg.uid}@${config.host}`;
          if (await this.recibidoRepo.findByEmailMessageId(empresa.id, messageId)) {
            skipped += 1;
            lastUid = Math.max(lastUid, msg.uid);
            continue;
          }

          const attachments = this.collectAttachments(parsed.attachments ?? []);
          const created = await this.ingestEmail({
            companyCode,
            empresaId: empresa.id,
            cedulaEmpresa: empresa.cedulaJuridica,
            messageId,
            uid: msg.uid,
            subject: parsed.subject ?? null,
            from: parsed.from?.text ?? null,
            receivedAt: parsed.date ?? new Date(),
            attachments,
          });

          if (created) processed += 1;
          else skipped += 1;
          lastUid = Math.max(lastUid, msg.uid);
        }
      } finally {
        lock.release();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new FeDomainError(
        `No se pudo conectar al buzón IMAP: ${message}`,
        "FE_IMAP_CONNECTION",
        502
      );
    } finally {
      await client.logout().catch(() => undefined);
    }

    if (lastUid > (empresa.imapLastUid ?? 0)) {
      await this.prisma.feEmpresa.update({
        where: { id: empresa.id },
        data: { imapLastUid: lastUid },
      });
    }

    return { processed, skipped, lastUid };
  }

  private createClient(input: {
    imapHost: string;
    imapPort: number;
    imapSecure: boolean;
    imapUser: string;
    imapPass: string;
    imapFolder?: string;
  }) {
    return new ImapFlow({
      host: input.imapHost,
      port: input.imapPort,
      secure: input.imapSecure,
      auth: { user: input.imapUser, pass: input.imapPass },
      logger: false,
    });
  }

  private collectAttachments(raw: Attachment[]): MailAttachment[] {
    const out: MailAttachment[] = [];
    for (const att of raw) {
      if (!att.content || !Buffer.isBuffer(att.content)) continue;
      const filename = att.filename?.trim() || "adjunto";
      out.push({
        filename,
        content: att.content,
        contentType: att.contentType || "application/octet-stream",
      });
    }
    return out;
  }

  private isXmlAttachment(a: MailAttachment): boolean {
    const name = a.filename.toLowerCase();
    if (name.endsWith(".xml") || a.contentType.includes("xml")) return true;
    try {
      return isFeComprobanteXml(a.content.toString("utf8", 0, Math.min(1200, a.content.length)));
    } catch {
      return false;
    }
  }

  private isPdfAttachment(a: MailAttachment): boolean {
    return a.filename.toLowerCase().endsWith(".pdf") || a.contentType.includes("pdf");
  }

  private async resolveFeFromAttachments(attachments: MailAttachment[]) {
    for (const att of attachments) {
      if (!this.isXmlAttachment(att)) continue;
      const xmlText = att.content.toString("utf8");
      const parsed = parseFacturaRecibidaXml(xmlText);
      if (parsed && isValidFeClave(parsed.clave)) {
        const pdfAtt = attachments.find((a) => this.isPdfAttachment(a)) ?? null;
        return { parsed, xmlAtt: att, pdfAtt, clave: parsed.clave };
      }
    }
    return null;
  }

  private async ingestEmail(params: {
    companyCode: string;
    empresaId: string;
    cedulaEmpresa: string;
    messageId: string;
    uid: number;
    subject: string | null;
    from: string | null;
    receivedAt: Date;
    attachments: MailAttachment[];
  }) {
    const fe = await this.resolveFeFromAttachments(params.attachments);
    if (!fe) return null;

    const { parsed, xmlAtt, pdfAtt, clave } = fe;

    if (
      !isComprobanteRecibidoValido(
        {
          xmlPath: xmlAtt ? "pending" : null,
          clave,
          cedulaEmisor: parsed.cedulaEmisor,
          parsedJson: parsed,
        },
        params.cedulaEmpresa
      )
    ) {
      feLogger.info("Correo omitido: no es factura electrónica de proveedor", {
        companyCode: params.companyCode,
        clave,
        cedulaEmisor: parsed.cedulaEmisor,
        tipo: parsed.tipoComprobante,
        subject: params.subject,
      });
      return null;
    }

    const recibidoId = randomUUID();
    const dir = feRecibidosDir(params.companyCode, recibidoId);
    await ensureFeDir(dir);

    let xmlPath: string | null = null;
    let pdfPath: string | null = null;

    if (xmlAtt) {
      const rel = feRelativePath(params.companyCode, "recibidos", recibidoId, "comprobante.xml");
      await writeFile(feAbsolutePath(rel), xmlAtt.content);
      xmlPath = rel;
    }
    if (pdfAtt) {
      const rel = feRelativePath(params.companyCode, "recibidos", recibidoId, "comprobante.pdf");
      await writeFile(feAbsolutePath(rel), pdfAtt.content);
      pdfPath = rel;
    }

    // Usamos upsert para evitar violación de restricción única (empresaId, clave)
    // cuando hay corridas concurrentes del poller IMAP. Si ya existe, retorna
    // el registro existente y no ejecutamos auto-aceptación.
    const row = await this.recibidoRepo.upsertByClave(params.empresaId, clave, {
      id: recibidoId,
      empresa: { connect: { id: params.empresaId } },
      estado: "PENDIENTE",
      origen: "IMAP",
      clave,
      cedulaEmisor: parsed?.cedulaEmisor ?? null,
      nombreEmisor: parsed?.nombreEmisor ?? null,
      consecutivoEmisor: parsed?.consecutivo ?? null,
      fechaEmision: parsed?.fechaEmision ?? null,
      montoTotal: parsed?.montoTotal ?? null,
      montoTotalImpuesto: parsed?.montoTotalImpuesto ?? null,
      emailMessageId: params.messageId,
      emailUid: params.uid,
      emailSubject: params.subject,
      emailFrom: params.from,
      emailReceivedAt: params.receivedAt,
      xmlPath,
      pdfPath,
      parsedJson: parsed ? (parsed as object) : undefined,
    });

    // Si el registro ya existía (upsert no lo creó), Prisma no distingue fácilmente;
    // detectamos por si el id que generamos no coincide con el retornado.
    if (row.id !== recibidoId) {
      // Ya existía → no procesar de nuevo (evita duplicar auto-aceptación)
      return null;
    }

    if (parsed?.cedulaEmisor && clave) {
      const trusted = await this.proveedorRepo.findActiveByCedula(params.empresaId, parsed.cedulaEmisor);
      if (trusted) {
        try {
          await this.recibidoService.responder(
            params.companyCode,
            row.id,
            {
              tipoMensaje: "1",
              detalleMensaje: "Aceptación automática — proveedor de confianza",
            },
            undefined,
            { auto: true }
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          await this.recibidoRepo.update(row.id, {
            estado: "ERROR",
            detalleError: `Auto-aceptación fallida: ${message.slice(0, 500)}`,
          });
        }
      }
    }

    return row;
  }
}
