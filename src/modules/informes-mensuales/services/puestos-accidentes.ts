import { readFile } from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import { MonthlyReportError } from "./reports";
import { buildIncidentSummary } from "./summary";
import { listMonthlyIncidents } from "./incidents";

const TEMPLATE_FILE = path.join(
  process.cwd(),
  "assets",
  "informes-mensuales",
  "Incidencias_Puestos_Accidentes.xlsx",
);

export const PUESTOS_ACCIDENTES_COLUMNS = [
  "Consecutivo",
  "Fecha",
  "Incidente",
  "Administrador",
  "Acción Inmediata",
  "Cliente",
  "Hora",
  "Zona",
  "Informe",
  "Investigación",
  "Status",
  "Fuente",
];

type SheetMatrix = unknown[][];

type ParsedIncident = {
  date: Date;
  year: number;
  values: string[];
  order: number;
};

export type PuestosAccidentesReport = {
  columns: string[];
  rows: string[][];
  meta: {
    total: number;
    baseConsecutive: number;
    firstConsecutive: string | null;
    lastConsecutive: string | null;
    year: number;
    sources: { puestos: number; accidentes: number };
  };
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

function sheetMatrix(workbook: XLSX.WorkBook, sheetName: string): SheetMatrix | null {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as SheetMatrix;
}

function findSheetName(workbook: XLSX.WorkBook, needle: string): string | null {
  const target = needle.toLowerCase();
  return workbook.SheetNames.find((name) => name.toLowerCase().includes(target)) ?? null;
}

function parseDate(value: string): { date: Date; year: number } | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);

  // xlsx entrega las fechas como M/D/AA; si el primer valor es > 12, es D/M.
  const month = first > 12 ? second : first;
  const day = first > 12 ? first : second;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { date: new Date(year, month - 1, day), year };
}

function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function timeMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function modeYear(incidents: ParsedIncident[]): number {
  const counts = new Map<number, number>();
  for (const incident of incidents) {
    counts.set(incident.year, (counts.get(incident.year) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? new Date().getFullYear();
}

async function maxDelMonteConsecutive(year: number): Promise<number> {
  let max = 0;

  try {
    const summary = await buildIncidentSummary({});
    if (summary.detail) {
      const index = summary.detail.columns.findIndex((column) =>
        /numero|consecutivo/i.test(column),
      );
      if (index >= 0) {
        for (const row of summary.detail.rows) {
          const match = /INC-(\d+)-(\d{4})/i.exec(row[index] ?? "");
          if (match && Number(match[2]) === year) {
            max = Math.max(max, Number(match[1]));
          }
        }
      }
    }
  } catch {
    // Si la plantilla de Del Monte no está disponible, seguimos con las manuales.
  }

  const manual = await listMonthlyIncidents("base");
  for (const incident of manual) {
    const key = Object.keys(incident.data).find((name) => /numero|consecutivo/i.test(name));
    const match = key ? /INC-(\d+)-(\d{4})/i.exec(incident.data[key] ?? "") : null;
    if (match && Number(match[2]) === year) {
      max = Math.max(max, Number(match[1]));
    }
  }

  return max;
}

export async function buildPuestosAccidentesReport(): Promise<PuestosAccidentesReport> {
  let buffer: Buffer;
  try {
    buffer = await readFile(TEMPLATE_FILE);
  } catch {
    throw new MonthlyReportError(
      "El archivo de incidencias de puestos y accidentes no está disponible",
      "NOT_FOUND",
    );
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    throw new MonthlyReportError("No se pudo leer el archivo Excel de incidencias");
  }

  const incidents: ParsedIncident[] = [];
  let order = 0;

  const puestosSheet = findSheetName(workbook, "puestos");
  if (puestosSheet) {
    const matrix = sheetMatrix(workbook, puestosSheet);
    let lastDate: { date: Date; year: number } | null = null;

    for (let rowIndex = 1; matrix && rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex];
      // xlsx recorta la columna A vacía: los datos empiezan en el índice 0.
      const incident = normalize(row[1]);
      if (!incident || incident.toLowerCase() === "incidente") continue;

      const parsed = parseDate(normalize(row[0]));
      if (parsed) lastDate = parsed;
      const currentDate = parsed ?? lastDate;
      if (!currentDate) continue;

      incidents.push({
        date: currentDate.date,
        year: currentDate.year,
        order: order++,
        values: [
          formatDate(currentDate.date),
          incident,
          normalize(row[2]),
          normalize(row[3]),
          normalize(row[4]),
          normalize(row[5]),
          normalize(row[6]),
          normalize(row[7]),
          normalize(row[8]),
          normalize(row[9]),
          "Puestos",
        ],
      });
    }
  }

  const accidentesSheet = findSheetName(workbook, "accident");
  if (accidentesSheet) {
    const matrix = sheetMatrix(workbook, accidentesSheet);
    let lastDate: { date: Date; year: number } | null = null;

    for (let rowIndex = 1; matrix && rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex];
      const incident = normalize(row[1]);
      if (!incident || incident.toLowerCase() === "incidente") continue;

      const parsed = parseDate(normalize(row[0]));
      if (parsed) lastDate = parsed;
      const currentDate = parsed ?? lastDate;
      if (!currentDate) continue;

      incidents.push({
        date: currentDate.date,
        year: currentDate.year,
        order: order++,
        values: [
          formatDate(currentDate.date),
          incident,
          "",
          normalize(row[2]),
          normalize(row[3]),
          normalize(row[4]),
          normalize(row[5]),
          normalize(row[6]),
          normalize(row[7]),
          normalize(row[8]),
          "Accidentes",
        ],
      });
    }
  }

  incidents.sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      timeMinutes(a.values[5]) - timeMinutes(b.values[5]) ||
      a.order - b.order,
  );

  const year = modeYear(incidents);
  const baseConsecutive = await maxDelMonteConsecutive(year);

  const rows = incidents.map((incident, index) => {
    const consecutive = `INC-${String(baseConsecutive + index + 1).padStart(4, "0")}-${year}`;
    return [consecutive, ...incident.values];
  });

  return {
    columns: PUESTOS_ACCIDENTES_COLUMNS,
    rows,
    meta: {
      total: rows.length,
      baseConsecutive,
      firstConsecutive: rows[0]?.[0] ?? null,
      lastConsecutive: rows[rows.length - 1]?.[0] ?? null,
      year,
      sources: {
        puestos: incidents.filter((incident) => incident.values[10] === "Puestos").length,
        accidentes: incidents.filter((incident) => incident.values[10] === "Accidentes").length,
      },
    },
  };
}
