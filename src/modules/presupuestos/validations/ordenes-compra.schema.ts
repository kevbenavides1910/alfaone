import { z } from "zod";

export const ordenesCompraListSchema = z.object({
  company: z.string().trim().min(1).optional(),
  search: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export type OrdenesCompraListInput = z.infer<typeof ordenesCompraListSchema>;
