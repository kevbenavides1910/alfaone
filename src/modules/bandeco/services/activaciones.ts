import { prisma } from "@/modules/core/db/prisma";
import { consultarCodigoAlarma, buildInformeActivacion } from "./consulta";

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export async function registrarActivacion(input: {
  alarmNumber: number;
  operadorName: string;
  operadorId?: string | null;
  estado?: string | null;
  informe?: string | null;
  mensaje?: string | null;
  tipoActivacion?: string | null;
}) {
  const consulta = await consultarCodigoAlarma(input.alarmNumber);
  if (!consulta) {
    throw new Error(`Código de alarma ${input.alarmNumber} no encontrado`);
  }

  const code = await prisma.bandecoAlarmCode.findUnique({
    where: { alarmNumber: input.alarmNumber },
    select: { id: true },
  });

  const now = new Date();
  const tipo = input.tipoActivacion ?? "normal";
  const mensaje =
    input.mensaje ??
    (tipo === "riesgo"
      ? consulta.mensajes.riesgo
      : tipo === "maxima"
        ? consulta.mensajes.maxima
        : consulta.mensajes.activacion);

  const estado =
    input.estado ?? "A este x11 informa el oficial que todo se encuentra en orden";

  const informe =
    input.informe ??
    buildInformeActivacion({
      fecha: formatDate(now),
      hora: formatTime(now),
      mensaje: "A este x11 tengo activación en:",
      finca: consulta.finca,
      zona: consulta.zona,
      estado,
      operadorName: input.operadorName,
    });

  return prisma.bandecoActivacion.create({
    data: {
      alarmNumber: input.alarmNumber,
      alarmCodeId: code?.id,
      finca: consulta.finca,
      zona: consulta.zona,
      motorizado: consulta.motorizado,
      bodycam: consulta.bodycam,
      grupoWsp: consulta.grupoWsp,
      encargado: consulta.encargado,
      numeroEncargado: consulta.numeroEncargado,
      operadorName: input.operadorName,
      operadorId: input.operadorId ?? null,
      estado,
      informe,
      mensaje,
      tipoActivacion: tipo,
    },
  });
}

export async function listActivaciones(opts?: { limit?: number; desde?: Date; hasta?: Date }) {
  const limit = opts?.limit ?? 200;
  return prisma.bandecoActivacion.findMany({
    where: {
      ...(opts?.desde || opts?.hasta
        ? {
            activatedAt: {
              ...(opts.desde ? { gte: opts.desde } : {}),
              ...(opts.hasta ? { lte: opts.hasta } : {}),
            },
          }
        : {}),
    },
    orderBy: { activatedAt: "desc" },
    take: limit,
  });
}

export async function buildInformeSemanal(desde: Date, hasta: Date) {
  const activaciones = await prisma.bandecoActivacion.findMany({
    where: { activatedAt: { gte: desde, lte: hasta } },
    orderBy: { activatedAt: "asc" },
  });

  const lines: string[] = [
    `INFORME SEMANAL ALFA BANDECO ${formatDate(desde)} - ${formatDate(hasta)}`,
    "",
  ];

  for (const act of activaciones) {
    lines.push(`Finca: ${act.finca}`);
    lines.push("INFORME DE ACTIVACIÓN");
    lines.push(`Fecha: ${formatDate(act.activatedAt)}`);
    lines.push(`Hora: ${formatTime(act.activatedAt)}`);
    lines.push(`Mensaje: A este x11 tengo activación en:`);
    lines.push(`Finca: ${act.finca}`);
    lines.push(`Ubicación: ${act.zona}`);
    lines.push(`Estado: ${act.estado ?? ""}`);
    lines.push(`Operador: ${act.operadorName}`);
    lines.push("Imagen de referencia:");
    lines.push("");
    lines.push("");
  }

  return lines.join("\n");
}
