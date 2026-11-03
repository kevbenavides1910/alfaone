import { z } from "zod";
import { FE_CODIGO_REFERENCIA_REP, FE_TIPO_DOC_IR_REP } from "../constants/hacienda-catalogos";

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
  claveReferencia: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/[^0-9A-Z]/g, ""))
    .refine((value) => value.length === 50, "La clave de referencia debe tener 50 caracteres"),
  codigoReferencia: z.enum(FE_CODIGO_REFERENCIA_REP).default("17"),
  tipoDocReferencia: z.enum(FE_TIPO_DOC_IR_REP).default("01"),
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
