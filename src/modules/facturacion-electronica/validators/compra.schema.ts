import { z } from "zod";

const cabysCompraSchema = z
  .string()
  .min(1)
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 13, "Código CABYS debe tener 13 dígitos");

const detalleCompraSchema = z.object({
  codigoCabys: cabysCompraSchema,
  descripcion: z.string().min(1),
  cantidad: z.coerce.number().positive(),
  unidadMedida: z.string().min(1).max(10),
  precioUnitario: z.coerce.number().nonnegative(),
  montoDescuento: z.coerce.number().nonnegative().default(0),
  tarifaImpuesto: z.coerce.number().nonnegative().default(13),
  montoImpuesto: z.coerce.number().nonnegative().default(0),
  totalLinea: z.coerce.number().nonnegative(),
});

export const createFeFacturaCompraSchema = z.object({
  puntoVentaId: z.string().uuid(),
  fecha: z.coerce.date(),
  moneda: z.enum(["CRC", "USD", "EUR"]).default("CRC"),
  tipoCambio: z.coerce.number().positive().default(1),
  condicionVenta: z.enum(["CONTADO", "CREDITO", "OTROS"]).default("CONTADO"),
  proveedorTipoIdentificacion: z.enum(["EXTRANJERO", "NO_CONTRIBUYENTE", "FISICA", "JURIDICA"]),
  proveedorIdentificacion: z.string().min(1),
  proveedorNombre: z.string().min(1),
  proveedorOtrasSenasExtranjero: z.string().max(300).optional(),
  claveReferencia: z.string().max(50).optional(),
  observaciones: z.string().optional(),
  subtotal: z.coerce.number().nonnegative(),
  totalDescuentos: z.coerce.number().nonnegative().default(0),
  totalImpuestos: z.coerce.number().nonnegative().default(0),
  total: z.coerce.number().nonnegative(),
  detalles: z.array(detalleCompraSchema).min(1),
});

export type CreateFeFacturaCompraInput = z.infer<typeof createFeFacturaCompraSchema>;
