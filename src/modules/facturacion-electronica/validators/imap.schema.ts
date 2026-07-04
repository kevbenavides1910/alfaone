import { z } from "zod";

export const updateFeImapSchema = z.object({
  imapEnabled: z.boolean(),
  imapHost: z.string().trim().min(1).optional().nullable(),
  imapPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  imapSecure: z.boolean().optional().nullable(),
  imapUser: z.string().trim().min(1).optional().nullable(),
  imapPass: z.string().optional(),
  imapFolder: z.string().trim().min(1).optional().nullable(),
  imapPuntoVentaId: z.string().uuid().optional().nullable(),
});

export type UpdateFeImapInput = z.infer<typeof updateFeImapSchema>;

export const testFeImapSchema = z.object({
  imapHost: z.string().trim().min(1),
  imapPort: z.coerce.number().int().min(1).max(65535).default(993),
  imapSecure: z.boolean().default(true),
  imapUser: z.string().trim().min(1),
  imapPass: z.string().min(1),
  imapFolder: z.string().trim().min(1).default("INBOX"),
});

export type TestFeImapInput = z.infer<typeof testFeImapSchema>;
