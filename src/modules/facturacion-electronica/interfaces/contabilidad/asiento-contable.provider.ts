export type AsientoContableRef = {
  module: string;
  asientoId: string;
  fecha: string;
};

export type AsientoContableLinea = {
  cuenta: string;
  debito: number;
  credito: number;
  descripcion?: string;
};

export type AsientoContableDraft = {
  ref: AsientoContableRef;
  lineas: AsientoContableLinea[];
  origenTipo: "FE_FACTURA" | "FE_NOTA_CREDITO" | "FE_NOTA_DEBITO";
  origenId: string;
};

/** Contrato para integración futura con módulo contable. */
export interface AsientoContableProvider {
  generarAsientoDesdeFactura(facturaId: string): Promise<AsientoContableRef>;
  generarAsientoDesdeNotaCredito(notaCreditoId: string): Promise<AsientoContableRef>;
  generarAsientoDesdeNotaDebito(notaDebitoId: string): Promise<AsientoContableRef>;
  reversarAsiento(ref: AsientoContableRef): Promise<void>;
}

/** Stub hasta que exista el módulo contable. */
export class NoOpAsientoContableProvider implements AsientoContableProvider {
  async generarAsientoDesdeFactura(facturaId: string): Promise<AsientoContableRef> {
    return {
      module: "contabilidad-pending",
      asientoId: `pending-factura-${facturaId}`,
      fecha: new Date().toISOString(),
    };
  }

  async generarAsientoDesdeNotaCredito(notaCreditoId: string): Promise<AsientoContableRef> {
    return {
      module: "contabilidad-pending",
      asientoId: `pending-nc-${notaCreditoId}`,
      fecha: new Date().toISOString(),
    };
  }

  async generarAsientoDesdeNotaDebito(notaDebitoId: string): Promise<AsientoContableRef> {
    return {
      module: "contabilidad-pending",
      asientoId: `pending-nd-${notaDebitoId}`,
      fecha: new Date().toISOString(),
    };
  }

  async reversarAsiento(_ref: AsientoContableRef): Promise<void> {
    /* no-op */
  }
}

export const defaultAsientoContableProvider = new NoOpAsientoContableProvider();

/**
 * Punto de extensión para vincular una factura FE con FacturaMensual del ERP.
 * Sin automatización por ahora — solo contrato documentado.
 */
export interface FacturaMensualLinkProvider {
  vincularFacturaMensual(feFacturaId: string, facturaMensualId: string): Promise<void>;
  desvincularFacturaMensual(feFacturaId: string): Promise<void>;
}

export class ManualFacturaMensualLinkProvider implements FacturaMensualLinkProvider {
  constructor(private readonly prisma: import("@prisma/client").PrismaClient) {}

  async vincularFacturaMensual(feFacturaId: string, facturaMensualId: string) {
    await this.prisma.feFactura.update({
      where: { id: feFacturaId },
      data: { facturaMensualId },
    });
  }

  async desvincularFacturaMensual(feFacturaId: string) {
    await this.prisma.feFactura.update({
      where: { id: feFacturaId },
      data: { facturaMensualId: null },
    });
  }
}
