import { z } from "zod";

const cabysSchema = z
  .string()
  .min(1)
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 13, "Código CABYS debe tener 13 dígitos");

const exoneracionSchema = z
  .object({
    exonTipoDocumento: z.string().length(2).optional(),
    exonNumeroDocumento: z.string().max(40).optional(),
    exonNombreInstitucion: z.string().max(160).optional(),
    exonFechaEmision: z.coerce.date().optional(),
    exonPorcentaje: z.coerce.number().min(0).max(100).optional(),
    exonMonto: z.coerce.number().nonnegative().optional(),
  })
  .optional();

const medioPagoRowSchema = z.object({
  tipo: z.enum([
    "EFECTIVO",
    "TARJETA",
    "CHEQUE",
    "TRANSFERENCIA_DEPOSITO",
    "RECAUDADO_TERCEROS",
    "SINPE_MOVIL",
    "PLATAFORMA_DIGITAL",
    "OTROS",
  ]),
  total: z.coerce.number().positive(),
  otro: z.string().min(3).max(100).optional(),
});

const otroCargoSchema = z.object({
  tipoDocumento: z.string().length(2),
  detalle: z.string().min(3).max(160),
  montoCargo: z.coerce.number().positive(),
  numeroIdentidadTercero: z.string().max(20).optional(),
  nombreTercero: z.string().max(100).optional(),
  porcentaje: z.coerce.number().min(0).max(100).optional(),
});

const detalleLineaSchema = z
  .object({
    codigo: z.string().optional(),
    codigoCabys: cabysSchema,
    descripcion: z.string().min(1),
    cantidad: z.coerce.number().positive(),
    unidadMedida: z.string().min(1).max(10),
    precioUnitario: z.coerce.number().nonnegative(),
    montoDescuento: z.coerce.number().nonnegative().default(0),
    codigoDescuento: z.string().length(2).optional(),
    naturalezaDescuento: z.string().min(3).max(80).optional(),
    codigoImpuesto: z.enum(["01", "02", "03", "04", "07", "08", "09", "10"]).default("08"),
    tarifaImpuesto: z.coerce.number().nonnegative().default(13),
    montoImpuesto: z.coerce.number().nonnegative().default(0),
    totalLinea: z.coerce.number().nonnegative(),
    exoneracion: exoneracionSchema,
    ivaCobradoFabrica: z.enum(["01", "02"]).optional(),
    impuestoAsumidoFabrica: z.coerce.number().nonnegative().default(0),
    partidaArancelaria: z.string().max(12).optional(),
    montoImpuestoExportacion: z.coerce.number().nonnegative().optional(),
  })
  .superRefine((line, ctx) => {
    if (line.montoDescuento > 0 && !line.naturalezaDescuento?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Naturaleza del descuento requerida cuando hay descuento",
        path: ["naturalezaDescuento"],
      });
    }
    const ex = line.exoneracion;
    if (ex?.exonNumeroDocumento?.trim()) {
      if (!ex.exonNombreInstitucion?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Institución requerida para exoneración",
          path: ["exoneracion", "exonNombreInstitucion"],
        });
      }
      if (!ex.exonFechaEmision) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fecha requerida para exoneración",
          path: ["exoneracion", "exonFechaEmision"],
        });
      }
      if (!ex.exonTipoDocumento?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tipo documento exoneración requerido",
          path: ["exoneracion", "exonTipoDocumento"],
        });
      }
    }
  });

const condicionVentaEnum = z.enum([
  "CONTADO",
  "CREDITO",
  "CONSIGNACION",
  "APARTADO",
  "ARRENDAMIENTO_OPCION_COMPRA",
  "ARRENDAMIENTO_FUNCION_FINANCIERA",
  "VENTA_MERCANCIA_NO_NACIONALIZADA",
  "VENTA_BIENES_USADOS",
  "ARRENDAMIENTO_OPERATIVO",
  "ARRENDAMIENTO_FINANCIERO",
  "OTROS",
]);

const tipoDocumentoEnum = z.enum([
  "FACTURA_ELECTRONICA",
  "TIQUETE_ELECTRONICO",
  "FACTURA_ELECTRONICA_EXPORTACION",
]);

export const createFeFacturaSchema = z
  .object({
    tipoDocumento: tipoDocumentoEnum.default("FACTURA_ELECTRONICA"),
    puntoVentaId: z.string().uuid(),
    clienteId: z.string().uuid().optional(),
    fecha: z.coerce.date(),
    moneda: z.enum(["CRC", "USD", "EUR"]).default("CRC"),
    tipoCambio: z.coerce.number().positive().default(1),
    condicionVenta: condicionVentaEnum,
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
    mediosPago: z.array(medioPagoRowSchema).max(4).optional(),
    plazoCredito: z.coerce.number().int().positive().optional(),
    condicionVentaOtro: z.string().min(3).max(100).optional(),
    observaciones: z.string().optional(),
    subtotal: z.coerce.number().nonnegative(),
    totalDescuentos: z.coerce.number().nonnegative().default(0),
    totalImpuestos: z.coerce.number().nonnegative().default(0),
    totalOtrosCargos: z.coerce.number().nonnegative().default(0),
    otrosCargos: z.array(otroCargoSchema).max(15).optional(),
    totalIvaDevuelto: z.coerce.number().nonnegative().default(0),
    total: z.coerce.number().nonnegative(),
    detalles: z.array(detalleLineaSchema).min(1),
    facturaMensualId: z.string().cuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipoDocumento !== "TIQUETE_ELECTRONICO" && !data.clienteId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cliente requerido para este tipo de comprobante",
        path: ["clienteId"],
      });
    }
    if (data.condicionVenta === "OTROS" && !data.condicionVentaOtro?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Detalle requerido para condición Otros", path: ["condicionVentaOtro"] });
    }
    if (data.condicionVenta === "CREDITO" && !data.plazoCredito) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Plazo de crédito requerido", path: ["plazoCredito"] });
    }
    if (data.medioPago === "OTROS" && !data.medioPagoOtro?.trim() && !data.mediosPago?.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Detalle requerido para medio de pago Otros", path: ["medioPagoOtro"] });
    }
    if (data.mediosPago?.length) {
      const sum = data.mediosPago.reduce((s, m) => s + m.total, 0);
      if (Math.abs(sum - data.total) > 0.02) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La suma de medios de pago debe coincidir con el total",
          path: ["mediosPago"],
        });
      }
    }
    if (data.otrosCargos?.length) {
      const sum = data.otrosCargos.reduce((s, c) => s + c.montoCargo, 0);
      if (Math.abs(sum - data.totalOtrosCargos) > 0.02) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Total otros cargos debe coincidir con el detalle",
          path: ["otrosCargos"],
        });
      }
    }
    if (data.totalIvaDevuelto > 0 && data.medioPago !== "TARJETA" && !data.mediosPago?.some((m) => m.tipo === "TARJETA")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "IVA devuelto solo aplica con medio de pago Tarjeta",
        path: ["totalIvaDevuelto"],
      });
    }
  });

export const updateFeFacturaSchema = createFeFacturaSchema;

export const listFeFacturasSchema = z.object({
  companyCode: z.string().optional(),
  tipoDocumento: tipoDocumentoEnum.optional(),
  estado: z
    .enum([
      "BORRADOR",
      "PENDIENTE_ENVIO",
      "ENVIADA",
      "ACEPTADA",
      "ACEPTADA_PARCIALMENTE",
      "RECHAZADA",
      "ERROR",
      "ANULADA",
    ])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateFeFacturaInput = z.infer<typeof createFeFacturaSchema>;
export type ListFeFacturasQuery = z.infer<typeof listFeFacturasSchema>;
