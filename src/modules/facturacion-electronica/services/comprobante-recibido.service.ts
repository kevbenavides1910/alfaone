import type { FeComprobanteRecibidoEstado, PrismaClient } from "@prisma/client";
import { FeDomainError } from "../errors/fe-errors";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import { FeComprobanteRecibidoRepository } from "../repositories/fe-comprobante-recibido.repository";
import { FeMensajeReceptorRepository } from "../repositories/fe-mensaje-receptor.repository";
import { FeEmisionOrchestratorService } from "./emision-orchestrator.service";
import { FeGastoProveedorService } from "./gasto-proveedor.service";
import { resolveFeImapConfig } from "./mail/fe-imap";
import type { ResponderComprobanteRecibidoInput } from "../validators/comprobante-recibido.schema";
import {
  isComprobanteRecibidoValido,
  motivoRecibidoInvalido,
} from "../utils/fe-recibido-validacion";

const ESTADO_FINAL = new Set<FeComprobanteRecibidoEstado>([
  "ACEPTADO",
  "ACEPTADO_PARCIAL",
  "RECHAZADO",
  "AUTO_ACEPTADO",
]);

function estadoFromTipo(tipo: "1" | "2" | "3"): FeComprobanteRecibidoEstado {
  if (tipo === "1") return "ACEPTADO";
  if (tipo === "2") return "ACEPTADO_PARCIAL";
  return "RECHAZADO";
}

export class FeComprobanteRecibidoService {
  private readonly empresaRepo: FeEmpresaRepository;
  private readonly recibidoRepo: FeComprobanteRecibidoRepository;
  private readonly mensajeRepo: FeMensajeReceptorRepository;
  private readonly emision: FeEmisionOrchestratorService;
  private readonly gastos: FeGastoProveedorService;

  constructor(private readonly prisma: PrismaClient) {
    this.empresaRepo = new FeEmpresaRepository(prisma);
    this.recibidoRepo = new FeComprobanteRecibidoRepository(prisma);
    this.mensajeRepo = new FeMensajeReceptorRepository(prisma);
    this.emision = new FeEmisionOrchestratorService(prisma);
    this.gastos = new FeGastoProveedorService(prisma);
  }

  async list(companyCode: string, estado?: FeComprobanteRecibidoEstado) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const rows = await this.recibidoRepo.list(empresa.id, estado);
    return rows.filter((row) =>
      isComprobanteRecibidoValido(
        {
          xmlPath: row.xmlPath,
          clave: row.clave,
          cedulaEmisor: row.cedulaEmisor,
          parsedJson: row.parsedJson,
          estado: row.estado,
        },
        empresa.cedulaJuridica
      )
    );
  }

  async purgeInvalid(companyCode: string, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const rows = await this.recibidoRepo.listAllActive(empresa.id);
    const invalid = rows.filter(
      (row) =>
        !isComprobanteRecibidoValido(
          {
            xmlPath: row.xmlPath,
            clave: row.clave,
            cedulaEmisor: row.cedulaEmisor,
            parsedJson: row.parsedJson,
            estado: row.estado,
          },
          empresa.cedulaJuridica
        )
    );

    const result = await this.recibidoRepo.softDeleteMany(
      invalid.map((r) => r.id),
      userId
    );

    return {
      removed: result.count,
      items: invalid.map((row) => ({
        id: row.id,
        clave: row.clave,
        subject: row.emailSubject,
        motivo: motivoRecibidoInvalido(row, empresa.cedulaJuridica),
      })),
    };
  }

  async getById(companyCode: string, id: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const row = await this.recibidoRepo.findById(id, empresa.id);
    if (!row) throw new FeDomainError("Comprobante recibido no encontrado", "FE_RECIBIDO_NOT_FOUND", 404);
    return row;
  }

  async responder(
    companyCode: string,
    id: string,
    input: ResponderComprobanteRecibidoInput,
    userId?: string,
    opts?: { auto?: boolean }
  ) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const recibido = await this.recibidoRepo.findById(id, empresa.id);
    if (!recibido) throw new FeDomainError("Comprobante recibido no encontrado", "FE_RECIBIDO_NOT_FOUND", 404);
    if (ESTADO_FINAL.has(recibido.estado)) {
      throw new FeDomainError("Este comprobante ya fue procesado", "FE_RECIBIDO_YA_PROCESADO", 400);
    }

    const clave = (input.clave ?? recibido.clave)?.replace(/\D/g, "") ?? "";
    const cedulaEmisor = (input.cedulaEmisor ?? recibido.cedulaEmisor)?.replace(/\D/g, "") ?? "";

    if (clave.length !== 50) {
      throw new FeDomainError("Clave de 50 dígitos requerida", "FE_CLAVE_INVALIDA", 400);
    }
    if (cedulaEmisor.length < 9) {
      throw new FeDomainError("Cédula del emisor requerida", "FE_CEDULA_EMISOR_REQUERIDA", 400);
    }

    const imapConfig = resolveFeImapConfig(empresa);
    const puntoVentaId = imapConfig?.puntoVentaId;
    if (!puntoVentaId) {
      throw new FeDomainError(
        "Configure punto de venta IMAP en configuración del emisor",
        "FE_IMAP_PUNTO_VENTA",
        400
      );
    }

    const montoTotal = input.montoTotal ?? (recibido.montoTotal != null ? Number(recibido.montoTotal) : undefined);
    const montoTotalImpuesto =
      input.montoTotalImpuesto ??
      (recibido.montoTotalImpuesto != null ? Number(recibido.montoTotalImpuesto) : undefined);

    await this.recibidoRepo.update(id, {
      clave,
      cedulaEmisor,
      montoTotal: montoTotal ?? recibido.montoTotal,
      montoTotalImpuesto: montoTotalImpuesto ?? recibido.montoTotalImpuesto,
      updatedById: userId,
    });

    // Reintentos: tras ERROR de envío (p. ej. firma XAdES) ya existe un mensaje ligado
    // por comprobanteRecibidoId (@unique). Crear otro provoca P2002 "identificación duplicada".
    const existente = await this.mensajeRepo.findByComprobanteRecibidoId(empresa.id, id);
    let mensajeId: string;

    if (existente) {
      const reutilizable = ["BORRADOR", "ERROR", "PENDIENTE_ENVIO", "ENVIADA"].includes(
        existente.estado
      );
      if (!reutilizable) {
        // Mensaje ya aceptado/rechazado por Hacienda: sincronizar bandeja y salir
        const syncEstado = estadoFromTipo(
          (existente.tipoMensaje === "2" || existente.tipoMensaje === "3"
            ? existente.tipoMensaje
            : "1") as "1" | "2" | "3"
        );
        return this.recibidoRepo.update(id, {
          estado: syncEstado,
          updatedById: userId,
          detalleError: null,
        });
      }

      const mensaje = await this.mensajeRepo.updateForRetry(
        existente.id,
        {
          puntoVentaId,
          claveComprobante: clave,
          cedulaEmisor,
          tipoMensaje: input.tipoMensaje,
          detalleMensaje: input.detalleMensaje ?? null,
          montoTotal: montoTotal ?? null,
          montoTotalImpuesto: montoTotalImpuesto ?? null,
          // Vuelve a estado enviable para procesarEnvioMensajeReceptor
          estado: existente.estado === "ENVIADA" ? existente.estado : "ERROR",
        },
        userId
      );
      mensajeId = mensaje.id;
    } else {
      const mensaje = await this.mensajeRepo.create(
        empresa.id,
        {
          puntoVentaId,
          claveComprobante: clave,
          cedulaEmisor,
          tipoMensaje: input.tipoMensaje,
          detalleMensaje: input.detalleMensaje,
          montoTotal,
          montoTotalImpuesto,
        },
        userId
      );

      await this.prisma.feMensajeReceptor.update({
        where: { id: mensaje.id },
        data: { comprobanteRecibidoId: id },
      });
      mensajeId = mensaje.id;
    }

    await this.emision.procesarEnvioMensajeReceptor(mensajeId, companyCode, userId);

    const mensajeFinal = await this.mensajeRepo.findById(mensajeId, empresa.id);
    const esAuto = Boolean(opts?.auto);
    const nuevoEstado: FeComprobanteRecibidoEstado = esAuto
      ? "AUTO_ACEPTADO"
      : estadoFromTipo(input.tipoMensaje);

    const updated = await this.recibidoRepo.update(id, {
      estado: nuevoEstado,
      updatedById: userId,
      detalleError: mensajeFinal.estado === "ERROR" ? "Envío mensaje receptor falló" : null,
    });

    const esAceptacion = input.tipoMensaje === "1" || input.tipoMensaje === "2";
    if (esAceptacion && mensajeFinal.estado !== "ERROR") {
      await this.gastos.registrarDesdeRecibido({
        companyCode,
        comprobanteRecibidoId: id,
        xmlPath: recibido.xmlPath,
        estadoRecibo: nuevoEstado,
        fallback: {
          clave,
          cedulaEmisor,
          nombreEmisor: recibido.nombreEmisor,
          fechaEmision: recibido.fechaEmision,
          montoTotal: montoTotal ?? (recibido.montoTotal != null ? Number(recibido.montoTotal) : null),
          montoTotalImpuesto:
            montoTotalImpuesto ??
            (recibido.montoTotalImpuesto != null ? Number(recibido.montoTotalImpuesto) : null),
        },
        userId,
      });
    }

    return updated;
  }
}
