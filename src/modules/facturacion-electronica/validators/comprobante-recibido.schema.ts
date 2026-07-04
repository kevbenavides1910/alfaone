import { z } from "zod";

const baseResponder = z.object({
  tipoMensaje: z.enum(["1", "2", "3"]),
  detalleMensaje: z.string().trim().optional(),
  clave: z.string().length(50).optional(),
  cedulaEmisor: z.string().min(9).max(20).optional(),
  montoTotal: z.coerce.number().nonnegative().optional(),
  montoTotalImpuesto: z.coerce.number().nonnegative().optional(),
});

export const responderComprobanteRecibidoSchema = baseResponder.refine(
  (data) => {
    if (data.tipoMensaje === "2" || data.tipoMensaje === "3") {
      return !!data.detalleMensaje && data.detalleMensaje.length > 0;
    }
    return true;
  },
  {
    message: "El detalle es obligatorio para Aceptación Parcial (2) o Rechazo (3)",
    path: ["detalleMensaje"],
  },
);

export type ResponderComprobanteRecibidoInput = z.infer<typeof responderComprobanteRecibidoSchema>;
