import { z } from "zod";

const base = z.object({
  puntoVentaId: z.string().uuid(),
  claveComprobante: z.string().length(50),
  cedulaEmisor: z.string().min(9).max(20),
  tipoMensaje: z.enum(["1", "2", "3"]),
  detalleMensaje: z.string().trim().optional(),
  montoTotalImpuesto: z.coerce.number().nonnegative().optional(),
  montoTotal: z.coerce.number().nonnegative().optional(),
});

export const createFeMensajeReceptorSchema = base.refine(
  (data) => {
    if (data.tipoMensaje === "2" || data.tipoMensaje === "3") {
      return !!data.detalleMensaje && data.detalleMensaje.length > 0;
    }
    return true;
  },
  {
    message: "El detalle del mensaje es obligatorio para Aceptación Parcial (2) o Rechazo (3)",
    path: ["detalleMensaje"],
  },
);

export type CreateFeMensajeReceptorInput = z.infer<typeof createFeMensajeReceptorSchema>;
