import { z } from "zod";

export const facturacionDashboardSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
});

export type FacturacionDashboardInput = z.infer<typeof facturacionDashboardSchema>;
