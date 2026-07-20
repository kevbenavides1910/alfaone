import type { ColumnMeta, DataRow, KpiSnapshot } from "../types";
import { findColumnByPattern } from "./filter-engine";

const PATTERNS = {
  status: /estado|status|state/i,
  client: /cliente|client|customer|empresa/i,
  product: /producto|product|servicio/i,
  category: /categor[ií]a|category|tipo/i,
  technician: /t[eé]cnico|technician|asignado|assigned/i,
  severity: /severidad|severity|prioridad|priority/i,
  urgency: /urgencia|urgency|urgente/i,
  sla: /sla/i,
  opened: /apertura|opened|fecha.*creaci|created/i,
  resolved: /resoluci|resolved|cerrado|closed|cierre/i,
};

function isClosedStatus(value: string): boolean {
  return /cerrad|resuelt|closed|resolved|complet|finaliz/i.test(value);
}

function isOpenStatus(value: string): boolean {
  return /abiert|open|nuevo|new|asignad|proceso|progress|pendiente/i.test(value);
}

function isHighSeverity(value: string): boolean {
  return /alta|high|cr[ií]tic|urgent|urgente/i.test(value);
}

function countUnique(rows: DataRow[], columnId: string): number {
  return new Set(rows.map((r) => String(r[columnId] ?? "").trim()).filter(Boolean)).size;
}

function countWhere(rows: DataRow[], columnId: string, predicate: (v: string) => boolean): number {
  return rows.filter((r) => predicate(String(r[columnId] ?? ""))).length;
}

function avgResolutionDays(rows: DataRow[], openedCol: string, resolvedCol: string): number | null {
  const diffs: number[] = [];
  for (const row of rows) {
    const a = Date.parse(String(row[openedCol] ?? ""));
    const b = Date.parse(String(row[resolvedCol] ?? ""));
    if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) {
      diffs.push((b - a) / (1000 * 60 * 60 * 24));
    }
  }
  if (diffs.length === 0) return null;
  return Math.round((diffs.reduce((s, d) => s + d, 0) / diffs.length) * 10) / 10;
}

/** Calcula KPIs dinámicamente según columnas detectadas. */
export function computeKpis(rows: DataRow[], columns: ColumnMeta[]): KpiSnapshot[] {
  const kpis: KpiSnapshot[] = [
    { id: "total", label: "Total de Incidentes", value: rows.length },
  ];

  const statusCol = findColumnByPattern(columns, PATTERNS.status);
  if (statusCol) {
    kpis.push(
      { id: "open", label: "Incidentes Abiertos", value: countWhere(rows, statusCol.id, isOpenStatus) },
      { id: "closed", label: "Incidentes Cerrados", value: countWhere(rows, statusCol.id, isClosedStatus) },
      {
        id: "pending",
        label: "Pendientes",
        value: rows.length - countWhere(rows, statusCol.id, isClosedStatus),
      }
    );
  }

  const clientCol = findColumnByPattern(columns, PATTERNS.client);
  if (clientCol) kpis.push({ id: "clients", label: "Clientes", value: countUnique(rows, clientCol.id) });

  const productCol = findColumnByPattern(columns, PATTERNS.product);
  if (productCol) kpis.push({ id: "products", label: "Productos", value: countUnique(rows, productCol.id) });

  const categoryCol = findColumnByPattern(columns, PATTERNS.category);
  if (categoryCol) kpis.push({ id: "categories", label: "Categorías", value: countUnique(rows, categoryCol.id) });

  const techCol = findColumnByPattern(columns, PATTERNS.technician);
  if (techCol) kpis.push({ id: "technicians", label: "Técnicos", value: countUnique(rows, techCol.id) });

  const sevCol = findColumnByPattern(columns, PATTERNS.severity);
  if (sevCol) {
    kpis.push({
      id: "highSeverity",
      label: "Alta Severidad",
      value: countWhere(rows, sevCol.id, isHighSeverity),
    });
  }

  const urgCol = findColumnByPattern(columns, PATTERNS.urgency);
  if (urgCol) {
    kpis.push({
      id: "urgent",
      label: "Urgentes",
      value: countWhere(rows, urgCol.id, isHighSeverity),
    });
  } else if (sevCol) {
    kpis.push({
      id: "urgent",
      label: "Urgentes",
      value: countWhere(rows, sevCol.id, (v) => /urgent/i.test(v)),
    });
  }

  const openedCol = findColumnByPattern(columns, PATTERNS.opened);
  const resolvedCol = findColumnByPattern(columns, PATTERNS.resolved);
  if (openedCol && resolvedCol) {
    const avg = avgResolutionDays(rows, openedCol.id, resolvedCol.id);
    if (avg != null) {
      kpis.push({
        id: "avgResolution",
        label: "Tiempo Prom. Resolución (días)",
        value: avg,
      });
    }
  }

  const slaCol = findColumnByPattern(columns, PATTERNS.sla);
  if (slaCol) {
    const breached = countWhere(rows, slaCol.id, (v) => /incumpl|breach|vencid|fail/i.test(v));
    kpis.push({ id: "sla", label: "SLA incumplido", value: breached, hint: "Según columna SLA detectada" });
  }

  return kpis;
}

export { PATTERNS };
