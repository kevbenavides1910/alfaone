import { prisma } from "@/modules/core/db/prisma";
import { consultarCodigoAlarma } from "./consulta";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export async function registrarAperturaCierre(input: {
  codigo: number;
  operadorName: string;
  horaApertura?: string | null;
  horaCierre?: string | null;
}) {
  const consulta = await consultarCodigoAlarma(input.codigo);
  if (!consulta) {
    throw new Error(`Código ${input.codigo} no encontrado en base de datos`);
  }

  const code = await prisma.bandecoAlarmCode.findUnique({
    where: { alarmNumber: input.codigo },
    select: { id: true },
  });

  const now = new Date();
  const dia = DIAS[now.getDay()];

  let estado: string | null = null;
  if (input.horaCierre && !input.horaApertura) estado = "Falta apertura";
  else if (input.horaApertura && !input.horaCierre) estado = "Abierto";
  else if (input.horaApertura && input.horaCierre) estado = "Cerrado";

  return prisma.bandecoAperturaCierre.create({
    data: {
      finca: consulta.finca,
      codigo: input.codigo,
      alarmCodeId: code?.id,
      ubicacion: consulta.zona,
      dia,
      fecha: now,
      horaApertura: input.horaApertura ?? null,
      horaCierre: input.horaCierre ?? null,
      operadorName: input.operadorName,
      estado,
    },
  });
}

export async function listAperturasCierres(opts?: { fecha?: Date; limit?: number }) {
  const limit = opts?.limit ?? 500;
  const where = opts?.fecha
    ? {
        fecha: {
          gte: new Date(opts.fecha.setHours(0, 0, 0, 0)),
          lte: new Date(opts.fecha.setHours(23, 59, 59, 999)),
        },
      }
    : {};

  return prisma.bandecoAperturaCierre.findMany({
    where,
    orderBy: [{ fecha: "desc" }, { horaApertura: "desc" }],
    take: limit,
  });
}

export async function listCierresPendientes(fecha?: Date) {
  const target = fecha ?? new Date();
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);

  return prisma.bandecoAperturaCierre.findMany({
    where: {
      fecha: { gte: start, lte: end },
      OR: [{ estado: "Falta apertura" }, { horaCierre: { not: null }, horaApertura: null }],
    },
    orderBy: { finca: "asc" },
  });
}
