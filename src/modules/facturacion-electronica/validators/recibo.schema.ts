import { z } from "zod";

const REP_CONDICIONES = [
  "PAGO_SERVICIOS_ESTADO",
  "VENTA_CREDITO_IVA_90_DIAS",
  "PAGO_VENTA_PARCELADO",
  "PAGO_VENTA_CREDITO",
] as const;

const detalleReciboSchema = z.object({
  descripcion: z.string().min(1),
  subTotal: z.coerce.number().nonnegative(),
  tarifaImpuesto: z.coerce.number().nonnegative().default(13),
  montoImpuesto: z.coerce.number().nonnegative().default(0),
  totalLinea: z.coerce.number().nonnegative(),
});

export const createFeReciboPagoSchema = z.object({
  puntoVentaId: z.string().uuid(),
  facturaReferenciaId: z.string().uuid().optional(),
  claveReferencia: z.string().min(1).max(50),
  codigoReferencia: z.enum(["01", "02", "03", "04", "05", "99"]).default("01"),
  tipoDocReferencia: z.enum(["01", "02", "03", "04", "07", "08", "09", "10"]).default("01"),
  fechaReferencia: z.coerce.date().optional(),
  razon: z.string().optional(),
  condicionVenta: z.enum(REP_CONDICIONES),
  medioPago: z.enum([
    "EFECTIVO",
    "TARJETA",
    "CHEQUE",
    "TRANSFERENCIA_DEPOSITO",
    "RECAUDADO_TERCEROS",
    "SINPE_MOVIL",
    "PLATAFORMA_DIGITAL",
    "OTROS",
  ]),
  medioPagoOtro: z.string().min(3).max(100).optional(),
  subtotal: z.coerce.number().nonnegative(),
  totalImpuestos: z.coerce.number().nonnegative().default(0),
  total: z.coerce.number().nonnegative(),
  detalles: z.array(detalleReciboSchema).min(1),
});

export type CreateFeReciboPagoInput = z.infer<typeof createFeReciboPagoSchema>;
