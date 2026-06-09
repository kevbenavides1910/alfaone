import { readFileSync } from "fs";
import type { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

function cellStr(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v).trim();
}

function cellNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parsePhone(v: unknown): string | null {
  const s = cellStr(v).replace(/,/g, "");
  return s || null;
}

type ImportStats = {
  alarmCodes: number;
  pantallas: number;
  puestos: number;
  camaras: number;
  aperturaCuentas: number;
  pilaFincas: number;
  activaciones: number;
  aperturasCierres: number;
  eventos: number;
};

export async function importBandecoFromXlsm(
  filePath: string,
  prisma: PrismaClient,
): Promise<ImportStats> {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  const stats: ImportStats = {
    alarmCodes: 0,
    pantallas: 0,
    puestos: 0,
    camaras: 0,
    aperturaCuentas: 0,
    pilaFincas: 0,
    activaciones: 0,
    aperturasCierres: 0,
    eventos: 0,
  };

  // BASE_DATOS
  const baseRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["BASE_DATOS"], { header: 1, defval: "" });
  for (let i = 1; i < baseRows.length; i++) {
    const r = baseRows[i];
    if (!r || !r[0]) continue;
    const alarmNumber = cellNum(r[0]);
    if (!alarmNumber) continue;

    await prisma.bandecoAlarmCode.upsert({
      where: { alarmNumber },
      create: {
        alarmNumber,
        finca: cellStr(r[1]),
        zona: cellStr(r[2]),
        motorizado: cellStr(r[3]),
        bodycam: cellStr(r[4]) || null,
        grupoWsp: cellStr(r[5]) || null,
        encargado: cellStr(r[6]) || null,
        numeroEncargado: parsePhone(r[7]),
      },
      update: {
        finca: cellStr(r[1]),
        zona: cellStr(r[2]),
        motorizado: cellStr(r[3]),
        bodycam: cellStr(r[4]) || null,
        grupoWsp: cellStr(r[5]) || null,
        encargado: cellStr(r[6]) || null,
        numeroEncargado: parsePhone(r[7]),
      },
    });
    stats.alarmCodes++;
  }

  // PANTALLAS
  const pantRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["PANTALLAS"], { header: 1, defval: "" });
  for (let i = 1; i < pantRows.length; i++) {
    const r = pantRows[i];
    if (!r || !r[0]) continue;
    const alarmNumber = cellNum(r[0]);
    if (!alarmNumber) continue;

    const code = await prisma.bandecoAlarmCode.findUnique({ where: { alarmNumber } });
    if (!code) continue;

    await prisma.bandecoPantalla.upsert({
      where: { alarmCodeId: code.id },
      create: {
        alarmCodeId: code.id,
        finca: cellStr(r[1]),
        zona: cellStr(r[2]),
        pantalla: cellNum(r[3]),
        camara: cellNum(r[4]),
        zonaExterna: cellStr(r[5]) || null,
        pantalla2: cellNum(r[6]),
        camara2: cellNum(r[7]),
      },
      update: {
        finca: cellStr(r[1]),
        zona: cellStr(r[2]),
        pantalla: cellNum(r[3]),
        camara: cellNum(r[4]),
        zonaExterna: cellStr(r[5]) || null,
        pantalla2: cellNum(r[6]),
        camara2: cellNum(r[7]),
      },
    });
    stats.pantallas++;
  }

  // PUESTOS
  const puestoRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["PUESTOS"], { header: 1, defval: "" });
  for (let i = 0; i < puestoRows.length; i++) {
    const name = cellStr(puestoRows[i]?.[0]);
    if (!name) continue;
    await prisma.bandecoPuesto.upsert({
      where: { name },
      create: { name, sortOrder: i + 1 },
      update: { sortOrder: i + 1 },
    });
    stats.puestos++;
  }

  // CAMARAS — grid layout per pantalla section
  const camRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["CAMARAS"], { header: 1, defval: "" });
  let currentPantalla = 0;
  for (const row of camRows) {
    if (!row) continue;
    const first = cellStr(row[0]);
    const pantMatch = first.match(/PANTALLA\s*#(\d+)/i);
    if (pantMatch) {
      currentPantalla = Number(pantMatch[1]);
      continue;
    }
    if (!currentPantalla) continue;

    for (let c = 1; c < row.length; c++) {
      const desc = cellStr(row[c]);
      if (!desc) continue;
      const numMatch = desc.match(/^(\d+)\s/);
      const camaraNum = numMatch ? Number(numMatch[1]) : c - 1;

      await prisma.bandecoCamara.upsert({
        where: { pantallaNum_camaraNum: { pantallaNum: currentPantalla, camaraNum } },
        create: { pantallaNum: currentPantalla, camaraNum, descripcion: desc },
        update: { descripcion: desc },
      });
      stats.camaras++;
    }
  }

  // APERTURAS
  const apeRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["APERTURAS"], { header: 1, defval: "" });
  await prisma.bandecoAperturaCuenta.deleteMany();
  for (let i = 3; i < apeRows.length; i++) {
    const r = apeRows[i];
    if (!r || !r[1]) continue;
    const finca = cellStr(r[0]);
    const cuentaNum = cellNum(r[1]);
    const nombreCuenta = cellStr(r[2]);
    if (!cuentaNum || !nombreCuenta) continue;

    await prisma.bandecoAperturaCuenta.create({
      data: { finca: finca || "—", cuentaNum, nombreCuenta },
    });
    stats.aperturaCuentas++;
  }

  // PILAS
  const pilaRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["PILAS"], { header: 1, defval: "" });
  for (let i = 2; i < pilaRows.length; i++) {
    const r = pilaRows[i];
    const finca = cellStr(r?.[1]);
    if (!finca) continue;

    await prisma.bandecoPilaFinca.upsert({
      where: { finca },
      create: {
        finca,
        desmane: cellStr(r[2]) || null,
        paneo: cellStr(r[3]) || null,
        zonaMotorizado: cellStr(r[4]) || null,
        observaciones: cellStr(r[6]) || null,
      },
      update: {
        desmane: cellStr(r[2]) || null,
        paneo: cellStr(r[3]) || null,
        zonaMotorizado: cellStr(r[4]) || null,
        observaciones: cellStr(r[6]) || null,
      },
    });
    stats.pilaFincas++;
  }

  // REGISTRO (historial)
  const regRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["REGISTRO"], { header: 1, defval: "" });
  const existingCount = await prisma.bandecoActivacion.count();
  if (existingCount === 0) {
    for (let i = 2; i < regRows.length; i++) {
      const r = regRows[i];
      if (!r || !r[1]) continue;
      const activatedAt = r[0] instanceof Date ? r[0] : new Date(cellStr(r[0]));
      const alarmNumber = cellNum(r[1]);
      if (!alarmNumber || isNaN(activatedAt.getTime())) continue;

      const code = await prisma.bandecoAlarmCode.findUnique({ where: { alarmNumber } });

      await prisma.bandecoActivacion.create({
        data: {
          activatedAt,
          alarmNumber,
          alarmCodeId: code?.id,
          finca: cellStr(r[2]),
          zona: cellStr(r[3]),
          motorizado: cellStr(r[4]) || null,
          bodycam: cellStr(r[5]) || null,
          grupoWsp: cellStr(r[6]) || null,
          encargado: cellStr(r[7]) || null,
          numeroEncargado: parsePhone(r[8]),
          operadorName: cellStr(r[9]) || "Importado",
          operadorId: cellStr(r[10]) || null,
        },
      });
      stats.activaciones++;
    }
  }

  // APEYCE
  const aycRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["APEYCE"], { header: 1, defval: "" });
  const aycCount = await prisma.bandecoAperturaCierre.count();
  if (aycCount === 0) {
    for (let i = 1; i < aycRows.length; i++) {
      const r = aycRows[i];
      if (!r || !r[1]) continue;
      const codigo = cellNum(r[1]);
      if (!codigo) continue;
      const fecha = r[4] instanceof Date ? r[4] : new Date(cellStr(r[4]));
      if (isNaN(fecha.getTime())) continue;

      const code = await prisma.bandecoAlarmCode.findUnique({ where: { alarmNumber: codigo } });

      await prisma.bandecoAperturaCierre.create({
        data: {
          finca: cellStr(r[0]),
          codigo,
          alarmCodeId: code?.id,
          ubicacion: cellStr(r[2]),
          dia: cellStr(r[3]) || null,
          fecha,
          horaApertura: cellStr(r[5]) || null,
          horaCierre: cellStr(r[6]) || null,
          operadorName: cellStr(r[7]) || "Importado",
        },
      });
      stats.aperturasCierres++;
    }
  }

  return stats;
}
