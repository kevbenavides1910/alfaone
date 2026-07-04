import type { VentasOportunidadEstado } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import type {
  OportunidadCreateInput,
  OportunidadUpdateEstadoInput,
} from "../validations/oportunidad.schema";
import { normalizeLicitacionNo } from "./normalize-licitacion";

function parseFechaPresentacion(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Fecha de presentación inválida");
  return d;
}

export async function createOportunidad(input: OportunidadCreateInput) {
  const licitacionNo = normalizeLicitacionNo(input.licitacionNo);
  const existing = await prisma.ventasOportunidad.findUnique({ where: { licitacionNo } });
  if (existing) {
    return { created: false as const, row: existing };
  }

  const row = await prisma.ventasOportunidad.create({
    data: {
      licitacionNo,
      cliente: input.cliente.trim(),
      descripcion: input.descripcion.trim(),
      fechaPresentacion: parseFechaPresentacion(input.fechaPresentacion),
      enlace: input.enlace?.trim() || null,
      source: input.source?.trim() || null,
    },
  });

  return { created: true as const, row };
}

export async function updateOportunidadEstado(
  id: string,
  input: OportunidadUpdateEstadoInput,
  userId: string
) {
  const existing = await prisma.ventasOportunidad.findUnique({ where: { id } });
  if (!existing) return null;

  const isDecision = input.estado === "PARTICIPAR" || input.estado === "NO_PARTICIPAR";

  const row = await prisma.ventasOportunidad.update({
    where: { id },
    data: {
      estado: input.estado as VentasOportunidadEstado,
      decidedAt: isDecision ? new Date() : null,
      decidedById: isDecision ? userId : null,
    },
    include: { decidedBy: { select: { name: true } } },
  });

  return row;
}
