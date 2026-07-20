/**
 * Aplica cargas sociales estándar a todas las empresas NAF:
 * - Póliza INS → 3.09%
 * - Vacaciones → 4.16% (código VACACIONES)
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const POLIZA_INS_PCT = 3.09;
const VACACIONES_PCT = 4.16;

function toDecimal(value) {
  return new Prisma.Decimal(value);
}

async function main() {
  const companies = await prisma.nafCargaSocial.findMany({
    where: { isActive: true },
    distinct: ["noCia"],
    select: { noCia: true },
    orderBy: { noCia: "asc" },
  });

  if (companies.length === 0) {
    console.log("No hay empresas con cargas sociales.");
    return;
  }

  for (const { noCia } of companies) {
    await prisma.nafCargaSocial.updateMany({
      where: { noCia, codigo: "POLIZA_INS", isActive: true },
      data: { porcentaje: toDecimal(POLIZA_INS_PCT) },
    });

    await prisma.nafCargaSocial.updateMany({
      where: {
        noCia,
        isActive: true,
        codigo: { not: "VACACIONES" },
        nombre: { contains: "vacacion", mode: "insensitive" },
      },
      data: { isActive: false },
    });

    const maxSort = await prisma.nafCargaSocial.aggregate({
      where: { noCia },
      _max: { sortOrder: true },
    });

    await prisma.nafCargaSocial.upsert({
      where: { noCia_codigo: { noCia, codigo: "VACACIONES" } },
      create: {
        noCia,
        codigo: "VACACIONES",
        nombre: "Vacaciones",
        porcentaje: toDecimal(VACACIONES_PCT),
        grupo: "GARANTIAS",
        sortOrder: (maxSort._max.sortOrder ?? 10) + 1,
        isActive: true,
      },
      update: {
        nombre: "Vacaciones",
        porcentaje: toDecimal(VACACIONES_PCT),
        grupo: "GARANTIAS",
        isActive: true,
      },
    });

    const rows = await prisma.nafCargaSocial.findMany({
      where: { noCia, isActive: true },
      select: { porcentaje: true },
    });
    const total = rows.reduce((sum, row) => sum + Number(row.porcentaje), 0);
    console.log(`${noCia}: ${rows.length} líneas, total ${total.toFixed(2)}%`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
