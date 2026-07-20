/** Líneas de facturación por administración (monto en vínculo o en la línea). */
export const administrationBillingLinesSelect = {
  billingLineId: true,
  monthlyAmount: true,
  billingLine: { select: { monthlyAmount: true } },
} as const;

/** Include mínimo para serializar montos por emisión/administración. */
export const facturaListSerializeInclude = {
  contract: {
    select: {
      licitacionNo: true,
      hiringType: true,
      monthlyBilling: true,
      billingHistory: {
        select: { periodMonth: true, monthlyBilling: true },
        orderBy: { periodMonth: "asc" as const },
      },
      demandBilling: {
        select: { periodYear: true, periodMonth: true, monthlyBilling: true },
      },
      administrations: {
        orderBy: { sortOrder: "asc" as const },
        select: {
          id: true,
          sortOrder: true,
          billingLines: { select: administrationBillingLinesSelect },
        },
      },
    },
  },
  requisitos: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      emision: { select: { administrationNameCopied: true, sortOrder: true } },
    },
  },
  emisiones: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      contractAdministrationId: true,
      administrationNameCopied: true,
      managerNameCopied: true,
      zoneNameCopied: true,
      sortOrder: true,
      closedAt: true,
      invoiceNumber: true,
      documentNumber: true,
      invoiceReceivedAt: true,
      subtotalFacturadoNaf: true,
      totalFacturadoNaf: true,
      nafDocumentos: {
        orderBy: { linkedAt: "asc" as const },
        select: {
          id: true,
          nafNoCia: true,
          nafTipoDoc: true,
          nafNoFactu: true,
          nafNoFisico: true,
          nafSerieFisico: true,
          nafConsecutivoFe: true,
          nafClaveFactura: true,
          nafFecha: true,
          subtotal: true,
          impuesto: true,
          total: true,
          amountSign: true,
          signedTotal: true,
          linkedAt: true,
        },
      },
    },
  },
} as const;

const facturaDetailInclude = {
  contract: {
    select: {
      licitacionNo: true,
      hiringType: true,
      administrations: {
        orderBy: { sortOrder: "asc" as const },
        select: {
          id: true,
          sortOrder: true,
          billingLines: { select: administrationBillingLinesSelect },
        },
      },
      specialServices: {
        select: {
          id: true,
          periodMonth: true,
          description: true,
          amount: true,
          startDate: true,
          endDate: true,
          notes: true,
        },
      },
    },
  },
  emisiones: { orderBy: { sortOrder: "asc" as const }, include: { requisitos: { orderBy: { sortOrder: "asc" as const } } } },
  requisitos: { where: { facturaMensualEmisionId: null }, orderBy: { sortOrder: "asc" as const } },
  lastCorrectionReturnedBy: { select: { name: true, email: true } },
  returnRequestRequestedBy: { select: { name: true, email: true } },
  returnRequestReviewedBy: { select: { name: true, email: true } },
} as const;

export { facturaDetailInclude };
