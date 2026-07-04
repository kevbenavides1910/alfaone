import { z } from "zod";
import { companyCodeSchema } from "@/modules/core/validations/company-code";

const pct = z.number().min(0).max(1).default(0);

const contractInputSchema = z.object({
  licitacionNo: z.string().min(3, "Número de licitación requerido"),
  company: companyCodeSchema,
  client: z.string().min(2, "Cliente requerido"),
  clientType: z.enum(["PUBLIC", "PRIVATE"]),
  hiringType: z.enum(["FIXED", "ON_DEMAND"]).default("FIXED"),
  officersCount: z.number().int().min(1, "Mínimo 1 oficial"),
  positionsCount: z.number().int().min(1, "Mínimo 1 puesto"),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  monthlyBilling: z.number().positive("La facturación debe ser positiva"),
  ivaPct: z.number().min(0).max(100).default(13),
  billingDay: z.number().int().min(1).max(31).default(1),
  billingPeriodFromDay: z.number().int().min(1).max(31).default(1),
  billingPeriodToDay: z.number().int().min(1).max(31).default(31),
  laborPct: pct,
  suppliesPct: pct,
  adminPct: pct,
  profitPct: pct,
  status: z.enum(["ACTIVE", "PROLONGATION", "SUSPENDED", "FINISHED", "CANCELLED"]).default("ACTIVE"),
  notes: z.string().optional(),
});

function distributionSumsTo100(data: {
  laborPct: number;
  suppliesPct: number;
  adminPct: number;
  profitPct: number;
}) {
  // Permitimos pequeno margen para redondeos humanos/UI (ej. 83.44 + 5.50 + 1.06 + 10.00)
  // y precision de parseo decimal; evita bloquear contratos que efectivamente suman 100%.
  return Math.abs(data.laborPct + data.suppliesPct + data.adminPct + data.profitPct - 1) < 0.001;
}

export const contractCreateSchema = contractInputSchema
  .refine(
    (data) => distributionSumsTo100(data),
    {
      message: "Mano de obra + Insumos + Gasto administrativo + Utilidad deben sumar 100%",
      path: ["suppliesPct"],
    }
  )
  .refine(
    (data) => new Date(data.endDate) > new Date(data.startDate),
    { message: "La fecha de cierre debe ser posterior a la de inicio", path: ["endDate"] }
  );

export const contractUpdateSchema = contractInputSchema
  .partial()
  .omit({ licitacionNo: true })
  .superRefine((data, ctx) => {
    const L = data.laborPct;
    const S = data.suppliesPct;
    const A = data.adminPct;
    const P = data.profitPct;
    if (L !== undefined && S !== undefined && A !== undefined && P !== undefined) {
      if (!distributionSumsTo100({ laborPct: L, suppliesPct: S, adminPct: A, profitPct: P })) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Mano de obra + Insumos + Gasto administrativo + Utilidad deben sumar 100%",
          path: ["suppliesPct"],
        });
      }
    }
  });

export const periodSchema = z.object({
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  monthlyBilling: z.number().positive(),
  notes: z.string().optional(),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: "La fecha de cierre debe ser posterior a la de inicio", path: ["endDate"] }
);

export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;
export type PeriodInput = z.infer<typeof periodSchema>;

export const billingRequirementSchema = z.object({
  description: z.string().min(2, "Descripción requerida"),
  notes: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const billingRequirementUpdateSchema = billingRequirementSchema.partial();

export type BillingRequirementInput = z.infer<typeof billingRequirementSchema>;

const specialServiceBaseSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM requerido"),
  description: z.string().min(2, "Descripción requerida"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  notes: z.string().optional(),
});

export const specialServiceSchema = specialServiceBaseSchema.refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: "La fecha fin debe ser igual o posterior a la fecha inicio", path: ["endDate"] }
);

export const specialServiceUpdateSchema = specialServiceBaseSchema.partial();

export type SpecialServiceInput = z.infer<typeof specialServiceSchema>;

const clientContactBaseSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  jobTitle: z.string().optional(),
  isBillingContact: z.boolean().default(false),
  isContractAdmin: z.boolean().default(false),
  phone: z.string().min(6, "Teléfono requerido"),
  phone2: z.string().optional(),
  email: z.string().email("Correo electrónico inválido"),
  sortOrder: z.coerce.number().int().optional(),
});

export const clientContactSchema = clientContactBaseSchema;

export const clientContactUpdateSchema = clientContactBaseSchema.partial();

export type ClientContactInput = z.infer<typeof clientContactSchema>;

export const contractBillingLineSchema = z.object({
  lineCode: z.string().min(1, "Código requerido").max(40),
  description: z.string().min(1, "Descripción requerida").max(500),
  monthlyAmount: z.number().positive().optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
});

export const contractBillingLineUpdateSchema = contractBillingLineSchema.partial();

export type ContractBillingLineInput = z.infer<typeof contractBillingLineSchema>;

export const contractAdministrationSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  managerName: z.string().min(1, "Encargado requerido").max(200),
  managerEmail: z
    .string()
    .email("Correo inválido")
    .optional()
    .nullable()
    .or(z.literal("")),
  managerPhone: z.string().optional().nullable(),
  zoneId: z.string().nullable().optional(),
  billingLineIds: z.array(z.string()).default([]),
  billingPeriodFromDay: z.number().int().min(1).max(31).nullable().optional(),
  billingPeriodToDay: z.number().int().min(1).max(31).nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const contractAdministrationUpdateSchema = contractAdministrationSchema.partial();

export type ContractAdministrationInput = z.infer<typeof contractAdministrationSchema>;
