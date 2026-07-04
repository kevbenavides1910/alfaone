import { z } from "zod";

const detalleLineaSchema = z.object({
  codigo: z.string().optional(),
  codigoCabys: z.string().max(13).optional(),
  descripcion: z.string().min(1),
  cantidad: z.coerce.number().positive(),
  unidadMedida: z.string().min(1).max(10),
  precioUnitario: z.coerce.number().nonnegative(),
  montoDescuento: z.coerce.number().nonnegative().default(0),
  codigoImpuesto: z.string().length(2).default("08"),
  tarifaImpuesto: z.coerce.number().nonnegative().default(13),
  montoImpuesto: z.coerce.number().nonnegative().default(0),
  totalLinea: z.coerce.number().nonnegative(),
});

export const createFeNotaSchema = z
  .object({
    referenciaTipo: z.enum(["FACTURA_VENTA", "FACTURA_COMPRA", "RECIBO_PAGO"]).default("FACTURA_VENTA"),
    facturaReferenciaId: z.string().uuid().optional(),
    facturaCompraReferenciaId: z.string().uuid().optional(),
    reciboPagoReferenciaId: z.string().uuid().optional(),
    razon: z.string().min(1),
    codigoReferencia: z.enum(["01", "02", "04", "05", "99"]).default("01"),
    subtotal: z.coerce.number().nonnegative(),
    totalDescuentos: z.coerce.number().nonnegative().default(0),
    totalImpuestos: z.coerce.number().nonnegative().default(0),
    total: z.coerce.number().nonnegative(),
    detalles: z.array(detalleLineaSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const count = [
      data.facturaReferenciaId,
      data.facturaCompraReferenciaId,
      data.reciboPagoReferenciaId,
    ].filter(Boolean).length;
    if (count !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe indicar exactamente un documento de referencia",
        path: ["facturaReferenciaId"],
      });
    }
    if (data.referenciaTipo === "FACTURA_VENTA" && !data.facturaReferenciaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "facturaReferenciaId requerido",
        path: ["facturaReferenciaId"],
      });
    }
    if (data.referenciaTipo === "FACTURA_COMPRA" && !data.facturaCompraReferenciaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "facturaCompraReferenciaId requerido",
        path: ["facturaCompraReferenciaId"],
      });
    }
    if (data.referenciaTipo === "RECIBO_PAGO" && !data.reciboPagoReferenciaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reciboPagoReferenciaId requerido",
        path: ["reciboPagoReferenciaId"],
      });
    }
  });

export type CreateFeNotaInput = z.infer<typeof createFeNotaSchema>;

export type FeDocumentKind =
  | "factura"
  | "nota_credito"
  | "nota_debito"
  | "mensaje_receptor"
  | "factura_compra"
  | "recibo_pago";
