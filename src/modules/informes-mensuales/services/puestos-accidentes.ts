import { PUESTOS_ACCIDENTES_SOURCE, listMonthlyIncidents } from "./incidents";
import { buildIncidentSummary } from "./summary";

export const PUESTOS_ACCIDENTES_COLUMNS = [
  "Consecutivo",
  "Tipo de Incidencia",
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

export type PuestosAccidentesRowMeta = {
  incidentId: string | null;
  evidenceCount: number;
  manual: boolean;
  data?: Record<string, string>;
};

type ParsedIncident = {
  date: Date;
  year: number;
  values: string[];
  order: number;
  manual: boolean;
  incidentId: string;
  evidenceCount: number;
  data: Record<string, string>;
};

export type PuestosAccidentesReport = {
  columns: string[];
  rows: string[][];
  rowMeta: PuestosAccidentesRowMeta[];
  meta: {
    total: number;
    baseConsecutive: number;
    firstConsecutive: string | null;
    lastConsecutive: string | null;
    year: number;
    sources: { puestos: number; accidentes: number; manual: number };
  };
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

function parseDate(value: string): { date: Date; year: number } | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const twoDigitYear = match[3].length === 2;
  const year = twoDigitYear ? 2000 + Number(match[3]) : Number(match[3]);

  // Las fechas importadas se guardan como D/M/AAAA.
  const month = twoDigitYear ? (first > 12 ? second : first) : second;
  const day = twoDigitYear ? (first > 12 ? first : second) : first;
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
  const storedRows = await listMonthlyIncidents(PUESTOS_ACCIDENTES_SOURCE);

  const incidents: ParsedIncident[] = storedRows
    .map((incident, index) => {
      const data = incident.data;
      const incidentText = normalize(data["Incidente"]);
      if (!incidentText) return null;

      const parsed =
        parseDate(normalize(data["Fecha"])) ??
        (() => {
          const created = new Date(incident.createdAt);
          return { date: created, year: created.getFullYear() };
        })();

      const fuente = normalize(data["Fuente"]) || "Puestos";
      const tipo =
        normalize(data["Tipo de Incidencia"]) ||
        (fuente === "Accidentes" ? "Accidente de Tránsito" : "Incidencia en Puesto");

      return {
        date: parsed.date,
        year: parsed.year,
        order: index,
        manual: normalize(data["__imported"]) !== "true",
        incidentId: incident.id,
        evidenceCount: incident.evidenceCount,
        data,
        values: [
          tipo,
          formatDate(parsed.date),
          incidentText,
          normalize(data["Administrador"]),
          normalize(data["Acción Inmediata"]),
          normalize(data["Cliente"]),
          normalize(data["Hora"]),
          normalize(data["Zona"]),
          normalize(data["Informe"]),
          normalize(data["Investigación"]),
          normalize(data["Status"]),
          fuente,
        ],
      };
    })
    .filter((incident): incident is ParsedIncident => incident !== null);

  incidents.sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      timeMinutes(a.values[6]) - timeMinutes(b.values[6]) ||
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
    rowMeta: incidents.map((incident) => ({
      incidentId: incident.incidentId,
      evidenceCount: incident.evidenceCount,
      manual: incident.manual,
      data: incident.data,
    })),
    meta: {
      total: rows.length,
      baseConsecutive,
      firstConsecutive: rows[0]?.[0] ?? null,
      lastConsecutive: rows[rows.length - 1]?.[0] ?? null,
      year,
      sources: {
        puestos: incidents.filter(
          (incident) => !incident.manual && incident.values[11] === "Puestos",
        ).length,
        accidentes: incidents.filter(
          (incident) => !incident.manual && incident.values[11] === "Accidentes",
        ).length,
        manual: incidents.filter((incident) => incident.manual).length,
      },
    },
  };
}
