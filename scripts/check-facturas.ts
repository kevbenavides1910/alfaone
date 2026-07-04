import { PrismaClient } from "@prisma/client";
import { serializeFacturaMensual } from "../src/modules/presupuestos/services/facturacion-cobro";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.facturaMensual.count();
  const may2026 = await prisma.facturaMensual.count({
    where: { periodYear: 2026, periodMonth: 5 },
  });
  const byMonth = await prisma.facturaMensual.groupBy({
    by: ["periodYear", "periodMonth"],
    _count: true,
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    take: 10,
  });

  console.log("total facturas:", total);
  console.log("may 2026:", may2026);
  console.log("by month:", byMonth);

  try {
    const rows = await prisma.facturaMensual.findMany({
      where: { periodYear: 2026, periodMonth: 5 },
      take: 2,
      include: {
        contract: { select: { licitacionNo: true } },
        requisitos: { orderBy: { sortOrder: "asc" } },
      },
    });
    console.log("serialize sample:", JSON.stringify(rows.map(serializeFacturaMensual), null, 2));
  } catch (e) {
    console.error("serialize failed:", e);
  }
}

main().finally(() => prisma.$disconnect());
