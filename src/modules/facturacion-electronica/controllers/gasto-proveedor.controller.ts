import type { PrismaClient } from "@prisma/client";
import { FeGastoProveedorService } from "../services/gasto-proveedor.service";

export class FeGastoProveedorController {
  private readonly service: FeGastoProveedorService;

  constructor(prisma: PrismaClient) {
    this.service = new FeGastoProveedorService(prisma);
  }

  resumen(companyCode: string, desde: Date, hasta: Date) {
    return this.service.resumen(companyCode, desde, hasta);
  }
}
