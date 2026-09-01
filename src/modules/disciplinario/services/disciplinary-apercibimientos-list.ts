import type { DisciplinaryStatus, DisciplinaryVigencia, Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";

const VALID_STATUS = new Set<DisciplinaryStatus>(["EMITIDO", "ENTREGADO", "FIRMADO", "ANULADO"]);
const VALID_VIGENCIA = new Set<DisciplinaryVigencia>([
  "VIGENTE",
  "VENCIDO",
  "PRESCRITO",
  "FINALIZADO",
  "ANULADO",
]);

export type ListDisciplinaryApercibimientosInput = {
  desde?: Date | null;
  hasta?: Date | null;
  zona?: string;
  sucursal?: string;
  administrador?: string;
  estado?: string;
  vigencia?: string;
  codigo?: string;
  nombre?: string;
  numero?: string;
  contrato?: string;
  cliente?: string;
  page?: number;
  limit?: number;
};

function buildWhere(input: ListDisciplinaryApercibimientosInput): Prisma.DisciplinaryApercibimientoWhereInput {
  const where: Prisma.DisciplinaryApercibimientoWhereInput = {};
  if (input.desde || input.hasta) {
    where.fechaEmision = {};
    if (input.desde) where.fechaEmision.gte = input.desde;
    if (input.hasta) {
      const end = new Date(input.hasta);
      end.setHours(23, 59, 59, 999);
      where.fechaEmision.lte = end;
    }
  }
  if (input.zona) where.zona = { contains: input.zona, mode: "insensitive" };
  if (input.sucursal) where.sucursal = { contains: input.sucursal, mode: "insensitive" };
  if (input.administrador) where.administrador = { contains: input.administrador, mode: "insensitive" };
  const estado = (input.estado || "").toUpperCase();
  if (estado && VALID_STATUS.has(estado as DisciplinaryStatus)) {
    where.estado = estado as DisciplinaryStatus;
  }
  const vigencia = (input.vigencia || "").toUpperCase();
  if (vigencia && VALID_VIGENCIA.has(vigencia as DisciplinaryVigencia)) {
    where.vigencia = vigencia as DisciplinaryVigencia;
  }
  if (input.codigo) where.codigoEmpleado = normalizeEmployeeCode(input.codigo);
  if (input.nombre) where.nombreEmpleado = { contains: input.nombre, mode: "insensitive" };
  if (input.numero) where.numero = { contains: input.numero, mode: "insensitive" };
  if (input.contrato) where.contrato = { contains: input.contrato, mode: "insensitive" };
  if (input.cliente) where.cliente = { contains: input.cliente, mode: "insensitive" };
  return where;
}

export async function listDisciplinaryApercibimientos(input: ListDisciplinaryApercibimientosInput) {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const page = Math.max(input.page ?? 1, 1);
  const skip = (page - 1) * limit;
  const where = buildWhere(input);

  const [total, rows] = await Promise.all([
    prisma.disciplinaryApercibimiento.count({ where }),
    prisma.disciplinaryApercibimiento.findMany({
      where,
      orderBy: [{ fechaEmision: "desc" }, { numero: "desc" }],
      skip,
      take: limit,
      select: {
        id: true,
        numero: true,
        fechaEmision: true,
        codigoEmpleado: true,
        nombreEmpleado: true,
        zona: true,
        sucursal: true,
        cantidadOmisiones: true,
        administrador: true,
        estado: true,
        vigencia: true,
        contrato: true,
        cliente: true,
        rutaPdf: true,
        evidenciaAnulacion: true,
        firmaRecibidoPath: true,
        firmaRecibidoAt: true,
        _count: { select: { omisiones: true } },
      },
    }),
  ]);

  const data = rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    fechaEmision: r.fechaEmision.toISOString(),
    codigoEmpleado: r.codigoEmpleado,
    nombreEmpleado: r.nombreEmpleado,
    zona: r.zona,
    sucursal: r.sucursal,
    cantidadOmisiones: r.cantidadOmisiones,
    administrador: r.administrador,
    estado: r.estado,
    vigencia: r.vigencia,
    contrato: r.contrato,
    cliente: r.cliente,
    omisionesCount: r._count.omisiones,
    pdfDisponible: !!r.rutaPdf,
    evidenciaDisponible: !!r.evidenciaAnulacion,
    firmado: !!r.firmaRecibidoPath,
    firmaRecibidoAt: r.firmaRecibidoAt?.toISOString() ?? null,
  }));

  return { total, page, limit, rows: data };
}
