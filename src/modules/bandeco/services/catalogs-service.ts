/**
 * Servicio de catálogos Bandeco.
 * Toda la lógica de acceso a base de datos de las rutas de mantenimiento vive aquí.
 * Las rutas API solo hacen: auth → validación Zod → llamar función de este servicio.
 */
import { prisma } from "@/modules/core/db/prisma";
import type { z } from "zod";
import type {
  alarmCodeSchema,
  pantallaSchema,
  puestoSchema,
  camaraSchema,
  pilaFincaSchema,
  aperturaCuentaSchema,
} from "@/modules/bandeco/validations/schemas";

// ── Alarm Codes ───────────────────────────────────────────────────────────────

export async function listAlarmCodes(q?: string | null) {
  return prisma.bandecoAlarmCode.findMany({
    where: q
      ? {
          OR: [
            { finca: { contains: q, mode: "insensitive" } },
            { zona: { contains: q, mode: "insensitive" } },
            { motorizado: { contains: q, mode: "insensitive" } },
            ...(Number.isFinite(Number(q)) ? [{ alarmNumber: Number(q) }] : []),
          ],
        }
      : undefined,
    include: { pantalla: true },
    orderBy: [{ alarmNumber: "asc" }],
  });
}

export async function createAlarmCode(data: z.infer<typeof alarmCodeSchema>) {
  return prisma.bandecoAlarmCode.create({
    data: {
      ...data,
      bodycam: data.bodycam ?? null,
      grupoWsp: data.grupoWsp ?? null,
      encargado: data.encargado ?? null,
      numeroEncargado: data.numeroEncargado ?? null,
    },
  });
}

export async function getAlarmCode(id: string) {
  return prisma.bandecoAlarmCode.findUnique({ where: { id } });
}

export async function updateAlarmCode(id: string, data: Partial<z.infer<typeof alarmCodeSchema>>) {
  return prisma.bandecoAlarmCode.update({
    where: { id },
    data: {
      ...data,
      bodycam: data.bodycam === undefined ? undefined : data.bodycam ?? null,
      grupoWsp: data.grupoWsp === undefined ? undefined : data.grupoWsp ?? null,
      encargado: data.encargado === undefined ? undefined : data.encargado ?? null,
      numeroEncargado: data.numeroEncargado === undefined ? undefined : data.numeroEncargado ?? null,
    },
  });
}

export async function deleteAlarmCode(id: string) {
  return prisma.bandecoAlarmCode.delete({ where: { id } });
}

// ── Pantallas ─────────────────────────────────────────────────────────────────

export async function listPantallas() {
  return prisma.bandecoPantalla.findMany({
    include: { alarmCode: { select: { alarmNumber: true, finca: true, zona: true } } },
    orderBy: { alarmCode: { alarmNumber: "asc" } },
  });
}

export async function createPantalla(data: z.infer<typeof pantallaSchema>) {
  return prisma.bandecoPantalla.create({
    data: {
      ...data,
      pantalla: data.pantalla ?? null,
      camara: data.camara ?? null,
      zonaExterna: data.zonaExterna ?? null,
      pantalla2: data.pantalla2 ?? null,
      camara2: data.camara2 ?? null,
    },
  });
}

export async function getPantalla(id: string) {
  return prisma.bandecoPantalla.findUnique({ where: { id } });
}

export async function updatePantalla(id: string, data: Partial<z.infer<typeof pantallaSchema>>) {
  return prisma.bandecoPantalla.update({ where: { id }, data });
}

export async function deletePantalla(id: string) {
  return prisma.bandecoPantalla.delete({ where: { id } });
}

// ── Puestos ───────────────────────────────────────────────────────────────────

export async function listPuestos() {
  return prisma.bandecoPuesto.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function createPuesto(data: z.infer<typeof puestoSchema>) {
  return prisma.bandecoPuesto.create({ data });
}

export async function getPuesto(id: string) {
  return prisma.bandecoPuesto.findUnique({ where: { id } });
}

export async function updatePuesto(id: string, data: Partial<z.infer<typeof puestoSchema>>) {
  return prisma.bandecoPuesto.update({ where: { id }, data });
}

export async function deletePuesto(id: string) {
  return prisma.bandecoPuesto.delete({ where: { id } });
}

// ── Cámaras ───────────────────────────────────────────────────────────────────

export async function listCamaras(pantallaNum?: number | null) {
  return prisma.bandecoCamara.findMany({
    where: pantallaNum != null ? { pantallaNum } : undefined,
    orderBy: [{ pantallaNum: "asc" }, { camaraNum: "asc" }],
  });
}

export async function createCamara(data: z.infer<typeof camaraSchema>) {
  return prisma.bandecoCamara.create({ data });
}

export async function getCamara(id: string) {
  return prisma.bandecoCamara.findUnique({ where: { id } });
}

export async function updateCamara(id: string, data: Partial<z.infer<typeof camaraSchema>>) {
  return prisma.bandecoCamara.update({ where: { id }, data });
}

export async function deleteCamara(id: string) {
  return prisma.bandecoCamara.delete({ where: { id } });
}

// ── Pilas por finca ───────────────────────────────────────────────────────────

export async function listPilasFincas() {
  return prisma.bandecoPilaFinca.findMany({ orderBy: { finca: "asc" } });
}

export async function createPilaFinca(data: z.infer<typeof pilaFincaSchema>) {
  return prisma.bandecoPilaFinca.create({
    data: {
      ...data,
      desmane: data.desmane ?? null,
      paneo: data.paneo ?? null,
      zonaMotorizado: data.zonaMotorizado ?? null,
      observaciones: data.observaciones ?? null,
    },
  });
}

export async function getPilaFinca(id: string) {
  return prisma.bandecoPilaFinca.findUnique({ where: { id } });
}

export async function updatePilaFinca(id: string, data: Partial<z.infer<typeof pilaFincaSchema>>) {
  return prisma.bandecoPilaFinca.update({ where: { id }, data });
}

export async function deletePilaFinca(id: string) {
  return prisma.bandecoPilaFinca.delete({ where: { id } });
}

// ── Cuentas de apertura ───────────────────────────────────────────────────────

export async function listAperturaCuentas(finca?: string | null) {
  return prisma.bandecoAperturaCuenta.findMany({
    where: finca ? { finca: { contains: finca, mode: "insensitive" } } : undefined,
    orderBy: [{ finca: "asc" }, { cuentaNum: "asc" }],
  });
}

export async function createAperturaCuenta(data: z.infer<typeof aperturaCuentaSchema>) {
  return prisma.bandecoAperturaCuenta.create({ data });
}

export async function getAperturaCuenta(id: string) {
  return prisma.bandecoAperturaCuenta.findUnique({ where: { id } });
}

export async function updateAperturaCuenta(id: string, data: Partial<z.infer<typeof aperturaCuentaSchema>>) {
  return prisma.bandecoAperturaCuenta.update({ where: { id }, data });
}

export async function deleteAperturaCuenta(id: string) {
  return prisma.bandecoAperturaCuenta.delete({ where: { id } });
}
