const facturaDetailInclude = {
  contract: {
    select: {
      licitacionNo: true,
      hiringType: true,
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
