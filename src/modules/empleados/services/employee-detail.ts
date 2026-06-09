import { prisma } from "@/modules/core/db/prisma";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";

export async function getEmployeeByCode(codigoRaw: string) {
  const codigo = normalizeEmployeeCode(codigoRaw);
  if (!codigo) return null;

  return prisma.employee.findUnique({
    where: { codigoEmpleado: codigo },
    include: {
      companyEntity: { select: { code: true, name: true, sapCode: true } },
      lastImportBatch: {
        select: { id: true, filename: true, createdAt: true },
      },
      placements: {
        orderBy: [{ contrato: "asc" }, { ubicacionNombre: "asc" }],
        include: {
          contract: {
            select: {
              id: true,
              licitacionNo: true,
              client: true,
              company: true,
              status: true,
            },
          },
        },
      },
    },
  });
}
