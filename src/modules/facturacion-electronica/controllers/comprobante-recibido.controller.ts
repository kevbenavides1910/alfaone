import type { FeComprobanteRecibidoEstado, PrismaClient } from "@prisma/client";
import { FeComprobanteRecibidoService } from "../services/comprobante-recibido.service";
import { FeIncomingMailService } from "../services/incoming/incoming-mail.service";
import { FeProveedorConfianzaService } from "../services/proveedor-confianza.service";
import type { ResponderComprobanteRecibidoInput } from "../validators/comprobante-recibido.schema";
import type {
  CreateFeProveedorConfianzaInput,
  UpdateFeProveedorConfianzaInput,
} from "../validators/proveedor-confianza.schema";

export class FeComprobanteRecibidoController {
  private readonly recibidos: FeComprobanteRecibidoService;
  private readonly incoming: FeIncomingMailService;

  constructor(prisma: PrismaClient) {
    this.recibidos = new FeComprobanteRecibidoService(prisma);
    this.incoming = new FeIncomingMailService(prisma);
  }

  list(companyCode: string, estado?: FeComprobanteRecibidoEstado) {
    return this.recibidos.list(companyCode, estado);
  }

  getById(companyCode: string, id: string) {
    return this.recibidos.getById(companyCode, id);
  }

  responder(companyCode: string, id: string, input: ResponderComprobanteRecibidoInput, userId?: string) {
    return this.recibidos.responder(companyCode, id, input, userId);
  }

  sync(companyCode: string) {
    return this.incoming.pollEmpresa(companyCode);
  }

  purgeInvalid(companyCode: string, userId?: string) {
    return this.recibidos.purgeInvalid(companyCode, userId);
  }
}

export class FeProveedorConfianzaController {
  private readonly service: FeProveedorConfianzaService;

  constructor(prisma: PrismaClient) {
    this.service = new FeProveedorConfianzaService(prisma);
  }

  list(companyCode: string) {
    return this.service.list(companyCode);
  }

  create(companyCode: string, input: CreateFeProveedorConfianzaInput, userId?: string) {
    return this.service.create(companyCode, input, userId);
  }

  update(companyCode: string, id: string, input: UpdateFeProveedorConfianzaInput, userId?: string) {
    return this.service.update(companyCode, id, input, userId);
  }

  remove(companyCode: string, id: string, userId?: string) {
    return this.service.remove(companyCode, id, userId);
  }
}
