import { expenseCreateSchema, type ExpenseCreateInput } from "@/modules/presupuestos/validations/expense.schema";
import { pickCell, parseNumber, parsePeriodMonthCell, rowToNormalized } from "@/modules/core/import/xlsx-read";
import { parseBoolCell, parseCompanyCell, parseExpenseBudgetLineCell, parseExpenseTypeCell } from "./parse-enums";

function str(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

export function normalizeLicitacionNo(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}

/** «Origen / Ref.» → nombre de catálogo y número de referencia. */
export function parseOriginRefCell(v: unknown): { originName: string; reference: string } {
  const raw = str(v);
  if (!raw) return { originName: "", reference: "" };
  const parts = raw.split(/[·|]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { originName: parts[0], reference: parts.slice(1).join(" ") };
  }
  if (/^\d+([.,]\d+)?$/.test(raw)) return { originName: "", reference: raw };
  return { originName: raw, reference: "" };
}

export type RepartoParse = {
  isDeferred: boolean;
  /** El Excel indica reparto manual pero no trae montos por contrato. */
  manualRequested: boolean;
  /** Cantidad en «Diferido proporcional (N contratos)» si aparece. */
  subsetCount: number | null;
};

/** Interpreta columna «Tipo reparto» del exporte de gastos. */
export function parseTipoRepartoCell(v: unknown): RepartoParse {
  const s = str(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!s) {
    return { isDeferred: false, manualRequested: false, subsetCount: null };
  }
  if (s.includes("contrato especifico")) {
    return { isDeferred: false, manualRequested: false, subsetCount: null };
  }
  if (s.includes("diferido")) {
    const manual = s.includes("manual");
    const m = s.match(/\((\d+)\s*contratos?\)/);
    return {
      isDeferred: true,
      manualRequested: manual,
      subsetCount: m ? Number.parseInt(m[1], 10) : null,
    };
  }
  return { isDeferred: false, manualRequested: false, subsetCount: null };
}

export type ExpenseImportOk = {
  ok: true;
  data: ExpenseCreateInput;
  /** Marcar como aprobado si el Excel trae Estado = Aprobado. */
  importApproved: boolean;
  warnings: string[];
};

export type ExpenseImportResult = ExpenseImportOk | { ok: false; sheetRow: number; message: string };

function lookupContract(
  licitacionNo: string,
  contractIdByLicitacion: Map<string, { id: string; company: string }>
): { id: string; company: string } | undefined {
  const key = normalizeLicitacionNo(licitacionNo);
  return contractIdByLicitacion.get(key) ?? contractIdByLicitacion.get(licitacionNo.trim());
}

/**
 * Mapea fila Excel a datos de gasto.
 * `contractIdByLicitacion` debe incluir la licitación indicada en la columna (si no es diferido).
 */
export function expenseRowFromSheet(
  row: Record<string, unknown>,
  sheetRow: number,
  contractIdByLicitacion: Map<string, { id: string; company: string }>,
  originIdByName: Map<string, string>,
  companyCatalog: { code: string; name: string }[]
): ExpenseImportResult {
  const norm = rowToNormalized(row);

  const type = parseExpenseTypeCell(pickCell(norm, ["tipo", "type", "tipo_gasto"]));
  if (!type) {
    return { ok: false, sheetRow, message: "Tipo de gasto no reconocido" };
  }

  const budgetLine = parseExpenseBudgetLineCell(
    pickCell(norm, ["partida", "budget_line", "linea_presupuestaria", "partida_presupuestaria"])
  );
  if (!budgetLine) {
    return { ok: false, sheetRow, message: "Partida presupuestaria inválida (Mano de obra, Insumos, etc.)" };
  }

  const description = str(pickCell(norm, ["descripcion", "description", "concepto"]));
  const amount = parseNumber(pickCell(norm, ["monto", "amount", "importe", "total"]));
  const periodMonth = parsePeriodMonthCell(
    pickCell(norm, ["mes", "periodo", "period_month", "mes_periodo"])
  );

  const licitacionNo = str(
    pickCell(norm, [
      "n_licitacion",
      "licitacion_no",
      "licitacion",
      "no_licitacion",
      "licitacionno",
      "contrato",
    ])
  );

  const reparto = parseTipoRepartoCell(
    pickCell(norm, ["tipo_reparto", "diferido", "is_deferred", "global", "diferido_global", "reparto"])
  );
  const warnings: string[] = [];

  let isDeferred = reparto.isDeferred;
  if (!isDeferred) {
    const deferredRaw = pickCell(norm, ["diferido", "is_deferred", "global", "diferido_global"]);
    if (deferredRaw !== undefined && deferredRaw !== null && String(deferredRaw).trim() !== "") {
      const parsed = parseBoolCell(deferredRaw);
      if (parsed === null) {
        return { ok: false, sheetRow, message: "Valor de «diferido» inválido (sí/no)" };
      }
      isDeferred = parsed;
    }
  }

  let contractId: string | undefined;
  let companyFromContract: string | undefined;

  if (!isDeferred) {
    if (!licitacionNo) {
      return { ok: false, sheetRow, message: "Indique licitación del contrato o marque gasto como diferido" };
    }
    const c = lookupContract(licitacionNo, contractIdByLicitacion);
    if (!c) {
      return {
        ok: false,
        sheetRow,
        message: `No hay contrato con licitación «${normalizeLicitacionNo(licitacionNo)}»`,
      };
    }
    contractId = c.id;
    companyFromContract = c.company;
  } else if (reparto.manualRequested) {
    warnings.push(
      "Reparto manual en Excel sin detalle por contrato; se importó como diferido proporcional (todos los contratos activos)."
    );
  } else if (reparto.subsetCount !== null) {
    warnings.push(
      `Reparto indicado para ${reparto.subsetCount} contrato(s) sin listado en Excel; se importó a todos los contratos activos.`
    );
  }

  const companyCell = pickCell(norm, ["empresa", "company", "compania"]);
  const companyParsed =
    companyCell !== undefined && companyCell !== null && String(companyCell).trim() !== ""
      ? parseCompanyCell(companyCell, companyCatalog)
      : null;
  const company = companyParsed ?? (companyFromContract as ExpenseCreateInput["company"]);
  if (!company) {
    return {
      ok: false,
      sheetRow,
      message: "Empresa requerida (columna o deducida del contrato)",
    };
  }

  if (!description || description.length < 2) {
    return { ok: false, sheetRow, message: "Descripción requerida (mín. 2 caracteres)" };
  }
  if (amount === null || amount <= 0) {
    return { ok: false, sheetRow, message: "Monto debe ser un número positivo" };
  }
  if (!periodMonth) {
    return { ok: false, sheetRow, message: "Mes inválido (use YYYY-MM, mes/año o «mayo 2026»)" };
  }

  const { originName, reference } = parseOriginRefCell(
    pickCell(norm, ["origen__ref", "origen", "origin", "origen_gasto", "origen_ref"])
  );
  let originId: string | undefined;
  if (originName) {
    const key = originName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    originId = originIdByName.get(key);
    if (!originId) {
      return { ok: false, sheetRow, message: `Origen «${originName}» no encontrado en catálogo` };
    }
  }

  const referenceNumber =
    str(pickCell(norm, ["referencia", "reference", "reference_number", "numero_referencia"])) ||
    reference ||
    undefined;

  const notesRaw = pickCell(norm, ["notas", "notes", "observaciones"]);
  const notes =
    notesRaw !== undefined && notesRaw !== null && String(notesRaw).trim() !== ""
      ? String(notesRaw).trim()
      : undefined;

  const spreadRaw = pickCell(norm, ["meses_prorrateo", "spread_months", "prorrateo"]);
  const spreadMonths =
    spreadRaw !== undefined && spreadRaw !== null && String(spreadRaw).trim() !== ""
      ? Math.round(Number(parseNumber(spreadRaw)))
      : 1;

  const registroCxp = str(pickCell(norm, ["registro_cxp", "registro_cxp_"]));
  const registroTr = str(pickCell(norm, ["registro_tr", "registro_tr_"]));

  const estadoRaw = str(pickCell(norm, ["estado", "status", "approval_status"]));
  const importApproved = /^aprobado$/i.test(
    estadoRaw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  );

  const raw: Record<string, unknown> = {
    type,
    budgetLine,
    description,
    amount,
    periodMonth,
    contractId,
    originId,
    referenceNumber: referenceNumber || undefined,
    company,
    isDeferred,
    notes,
    spreadMonths: Number.isFinite(spreadMonths) && spreadMonths >= 1 ? spreadMonths : 1,
    registroCxp: registroCxp || undefined,
    registroTr: registroTr || undefined,
  };

  const parsed = expenseCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = Object.values(first).flat()[0] ?? parsed.error.message;
    return { ok: false, sheetRow, message: String(msg) };
  }

  return { ok: true, data: parsed.data, importApproved, warnings };
}

/** Licitaciones a resolver contra la BD (filas no vacías, no diferidas, con número de licitación). */
export function collectLicitacionesFromExpenseRows(rows: Record<string, unknown>[]): string[] {
  const out = new Set<string>();
  for (const row of rows) {
    if (isEmptyExpenseRow(row)) continue;
    const norm = rowToNormalized(row);
    const reparto = parseTipoRepartoCell(pickCell(norm, ["tipo_reparto", "diferido", "is_deferred", "diferido_global"]));
    let isDeferred = reparto.isDeferred;
    if (!isDeferred) {
      const deferredRaw = pickCell(norm, ["diferido", "is_deferred", "global", "diferido_global"]);
      if (deferredRaw !== undefined && deferredRaw !== null && String(deferredRaw).trim() !== "") {
        const parsed = parseBoolCell(deferredRaw);
        isDeferred = parsed === true;
      }
    }
    if (isDeferred) continue;
    const lic = str(
      pickCell(norm, [
        "n_licitacion",
        "licitacion_no",
        "licitacion",
        "no_licitacion",
        "licitacionno",
        "contrato",
      ])
    );
    if (lic) out.add(normalizeLicitacionNo(lic));
  }
  return [...out];
}

export function isEmptyExpenseRow(row: Record<string, unknown>): boolean {
  const norm = rowToNormalized(row);
  const desc = str(pickCell(norm, ["descripcion", "description", "concepto"]));
  const amt = pickCell(norm, ["monto", "amount", "importe"]);
  return !desc && (amt === undefined || amt === null || String(amt).trim() === "");
}
