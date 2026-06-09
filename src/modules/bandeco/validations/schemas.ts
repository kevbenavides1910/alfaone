import { z } from "zod";

export const alarmCodeSchema = z.object({
  alarmNumber: z.coerce.number().int().positive(),
  finca: z.string().min(1).max(200),
  zona: z.string().min(1).max(200),
  motorizado: z.string().min(1).max(100),
  bodycam: z.string().max(100).nullable().optional(),
  grupoWsp: z.string().max(200).nullable().optional(),
  encargado: z.string().max(200).nullable().optional(),
  numeroEncargado: z.string().max(50).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const pantallaSchema = z.object({
  alarmCodeId: z.string().min(1),
  finca: z.string().min(1).max(200),
  zona: z.string().min(1).max(200),
  pantalla: z.coerce.number().int().nonnegative().nullable().optional(),
  camara: z.coerce.number().int().nonnegative().nullable().optional(),
  zonaExterna: z.string().max(200).nullable().optional(),
  pantalla2: z.coerce.number().int().nonnegative().nullable().optional(),
  camara2: z.coerce.number().int().nonnegative().nullable().optional(),
});

export const puestoSchema = z.object({
  name: z.string().min(1).max(100),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const camaraSchema = z.object({
  pantallaNum: z.coerce.number().int().nonnegative(),
  camaraNum: z.coerce.number().int().nonnegative(),
  descripcion: z.string().min(1).max(500),
});

export const aperturaCuentaSchema = z.object({
  finca: z.string().min(1).max(200),
  cuentaNum: z.coerce.number().int().positive(),
  nombreCuenta: z.string().min(1).max(200),
});

export const pilaFincaSchema = z.object({
  finca: z.string().min(1).max(200),
  desmane: z.string().max(50).nullable().optional(),
  paneo: z.string().max(50).nullable().optional(),
  zonaMotorizado: z.string().max(100).nullable().optional(),
  observaciones: z.string().max(500).nullable().optional(),
});

export const activacionSchema = z.object({
  alarmNumber: z.coerce.number().int().positive(),
  estado: z.string().max(500).nullable().optional(),
  informe: z.string().max(10000).nullable().optional(),
  mensaje: z.string().max(5000).nullable().optional(),
  tipoActivacion: z.enum(["normal", "riesgo", "maxima"]).default("normal"),
});

export const aperturaCierreSchema = z.object({
  codigo: z.coerce.number().int().positive(),
  horaApertura: z.string().max(20).nullable().optional(),
  horaCierre: z.string().max(20).nullable().optional(),
  operadorName: z.string().min(1).max(200),
});

export const eventoSchema = z.object({
  finca: z.string().min(1).max(200),
  motivo: z.string().max(500).nullable().optional(),
  informe: z.string().min(1).max(10000),
  operadorName: z.string().min(1).max(200),
  fecha: z.coerce.date().optional(),
  hora: z.string().max(20).nullable().optional(),
});
