import { pickCell, rowToNormalized, parseNumber } from "../../core/import/xlsx-read";

export const REAJUSTE_DOC_TYPES = new Set(["RT", "R2", "RP", "ND", "NC", "AF", "AN"]);

const COMPANY_ALIASES = [
  "compania",
  "compañia",
  "cxc__facturas_con_cliente_en_contratos",
  "cxc__facturas_sin_cliente_en_contratos",
];
const DOC_NUMBER_ALIASES = ["documento", "__empty"];
const INVOICE_NUMBER_ALIASES = ["factura_electronica", "factura_electrónica", "__empty_1"];
const REPEATS_ALIASES = ["repite", "__empty_2"];
const DOC_TYPE_ALIASES = ["tipo_documento", "__empty_5"];
const DOC_DATE_ALIASES = ["fecha_documento", "__empty_6"];
const SERVICE_PERIOD_ALIASES = ["periodo_servicio", "__empty_7"];
const MONTO_ORIGINAL_ALIASES = ["monto_original", "__empty_8"];
const SALDO_ALIASES = ["saldo", "__empty_9"];
const CLIENT_SAP_ALIASES = ["cliente", "__empty_10"];
const CLIENT_NAME_ALIASES = ["nombre", "__empty_11"];
const PLAZO_ALIASES = ["plazo", "__empty_12"];
const DIAS_VENCIDO_ALIASES = ["dias_vencido", "__empty_13"];
const FECHA_VENCER_ALIASES = ["fecha_vencer", "__empty_15"];
const VENCIDO_ALIASES = ["vencido", "__empty_16"];
const REVISAR_ALIASES = ["revisar", "__empty_17"];

export type ParsedCxcMassRow = {
  companySap: string;
  documentNumber: string;
  invoiceNumber: string | null;
  repeats: string | null;
  docType: string;
  documentDate: Date | null;
  servicePeriodDate: Date | null;
  montoOriginal: number | null;
  saldo: number | null;
  clientSapCode: string | null;
  clientName: string;
  plazoDays: number | null;
  diasVencido: number | null;
  diasParaVencer: number | null;
  montoVencido: number | null;
  revisarDias: number | null;
  isReajuste: boolean;
  hasContractHint: boolean;
  sheetRow: number;
};

function str(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function dashOrEmpty(v: unknown): string {
  const s = str(v);
  return s === "-" ? "" : s;
}

export function normalizeLicitacionNo(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}

export function normalizeClientKey(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function excelSerialToDate(serial: unknown): Date | null {
  if (serial instanceof Date && !Number.isNaN(serial.getTime())) {
    return new Date(Date.UTC(serial.getUTCFullYear(), serial.getUTCMonth(), serial.getUTCDate()));
  }
  const raw = dashOrEmpty(serial);
  if (!raw) return null;
  const n = typeof serial === "number" ? serial : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  return new Date(epoch.getTime() + Math.floor(n) * 86400000);
}

function parseDaysCell(v: unknown): number | null {
  const raw = dashOrEmpty(v);
  if (!raw) return null;
  const n = parseNumber(raw);
  if (n === null || Number.isNaN(n)) return null;
  return Math.round(n);
}

export function cleanInvoiceNumber(raw: string): string | null {
  const s = raw.replace(/^['"]+/, "").trim();
  return s && s !== "-" ? s : null;
}

export function isHeaderCxcMassRow(row: Record<string, unknown>): boolean {
  const norm = rowToNormalized(row);
  const doc = str(pickCell(norm, DOC_NUMBER_ALIASES));
  const tipo = str(pickCell(norm, DOC_TYPE_ALIASES));
  return /^documento$/i.test(doc) && /^tipo/i.test(tipo);
}

/** Título de bloque dentro de la hoja Revisado (Contratos vs Sin Contrato). */
export function isCxcSectionHeaderRow(
  row: Record<string, unknown>,
): "contratos" | "sinContrato" | null {
  for (const v of Object.values(row)) {
    const text = str(v).toLowerCase();
    if (!text) continue;
    if (text.includes("sin contrato") || text.includes("sin_cliente")) return "sinContrato";
    if (text.includes("con cliente en contrato") || text.includes("con_cliente")) return "contratos";
  }
  for (const k of Object.keys(row)) {
    const key = k.toLowerCase();
    if (key.includes("sin_cliente") || key.includes("sin contrato")) return "sinContrato";
    if (key.includes("con_cliente") || key.includes("contratos")) return "contratos";
  }
  return null;
}

export function cxcMassRowFromSheet(
  row: Record<string, unknown>,
  sheetRow: number,
  hasContractHint: boolean
): ParsedCxcMassRow | null {
  const norm = rowToNormalized(row);
  const documentNumber = str(pickCell(norm, DOC_NUMBER_ALIASES));
  const docType = str(pickCell(norm, DOC_TYPE_ALIASES)).toUpperCase();
  if (!documentNumber || !docType || /^documento$/i.test(documentNumber)) return null;

  const documentDate = excelSerialToDate(pickCell(norm, DOC_DATE_ALIASES));
  const servicePeriodDate = excelSerialToDate(pickCell(norm, SERVICE_PERIOD_ALIASES));

  return {
    companySap: str(pickCell(norm, COMPANY_ALIASES)),
    documentNumber,
    invoiceNumber: cleanInvoiceNumber(str(pickCell(norm, INVOICE_NUMBER_ALIASES))),
    repeats: dashOrEmpty(pickCell(norm, REPEATS_ALIASES)) || null,
    docType,
    documentDate,
    servicePeriodDate,
    montoOriginal: parseNumber(pickCell(norm, MONTO_ORIGINAL_ALIASES)),
    saldo: parseNumber(pickCell(norm, SALDO_ALIASES)),
    clientSapCode: dashOrEmpty(pickCell(norm, CLIENT_SAP_ALIASES)) || null,
    clientName: str(pickCell(norm, CLIENT_NAME_ALIASES)),
    plazoDays: parseDaysCell(pickCell(norm, PLAZO_ALIASES)),
    diasVencido: parseDaysCell(pickCell(norm, DIAS_VENCIDO_ALIASES)),
    diasParaVencer: parseDaysCell(pickCell(norm, FECHA_VENCER_ALIASES)),
    montoVencido: parseNumber(pickCell(norm, VENCIDO_ALIASES)),
    revisarDias: parseDaysCell(pickCell(norm, REVISAR_ALIASES)),
    isReajuste: REAJUSTE_DOC_TYPES.has(docType),
    hasContractHint,
    sheetRow,
  };
}

export function scoreClientName(excelName: string, contractClient: string): number {
  const a = normalizeClientKey(excelName);
  const b = normalizeClientKey(contractClient);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 92;

  const tokensA = new Set(a.split(" ").filter((t) => t.length >= 3));
  const tokensB = new Set(b.split(" ").filter((t) => t.length >= 3));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) shared++;
  }
  return Math.round((shared / Math.max(tokensA.size, tokensB.size)) * 85);
}

export function formatDocumentReajusteObservation(row: ParsedCxcMassRow): string {
  const saldo = row.saldo != null ? `₡${row.saldo.toLocaleString("es-CR")}` : "—";
  const parts = [
    `Reajuste ${row.docType} doc ${row.documentNumber}`,
    `saldo ${saldo}`,
    row.clientName,
  ];
  if (row.montoVencido != null && row.montoVencido > 0) {
    parts.push(`vencido ₡${row.montoVencido.toLocaleString("es-CR")}`);
  }
  return parts.join(" — ");
}

export function formatCxcImportObservation(row: ParsedCxcMassRow): string {
  const parts = [`CxC doc ${row.documentNumber}`];
  if (row.invoiceNumber) parts.push(`factura ${row.invoiceNumber}`);
  if (row.saldo != null) parts.push(`saldo ₡${row.saldo.toLocaleString("es-CR")}`);
  if (row.repeats) parts.push(`repite: ${row.repeats}`);
  if (row.diasVencido != null && row.diasVencido > 0) parts.push(`${row.diasVencido} días vencido`);
  if (row.revisarDias != null && row.revisarDias < 0) parts.push(`revisar ${Math.abs(row.revisarDias)} días atraso`);
  return parts.join(" · ");
}

export function appendObservation(existing: string | null | undefined, line: string): string {
  const base = (existing ?? "").trim();
  if (!base) return line;
  if (base.includes(line)) return base;
  return `${base}\n${line}`;
}

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export function periodFromDate(date: Date): { year: number; month: number } {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}
