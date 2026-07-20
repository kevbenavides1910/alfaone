import { prisma } from "@/modules/core/db/prisma";
import { normalizeSapCode } from "@/modules/empleados/business/company-sap";

export type RevisionChecklistFlags = {
  revisada: boolean;
  generada: boolean;
  /** Completa cuando todos los canales con monto están marcados (calculado en el servicio de revisión). */
  pagada: boolean;
  pagadaCk: boolean;
  pagadaDav: boolean;
  pagadaBn: boolean;
};

export type RevisionChecklistField =
  | "revisada"
  | "generada"
  | "pagada"
  | "pagadaCk"
  | "pagadaDav"
  | "pagadaBn";

function calendarDateKey(value: Date | string): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha inválida: ${value}`);
  }
  return date;
}

function toDateOnly(value: string): Date {
  const key = calendarDateKey(parseDateInput(value));
  if (!key) throw new Error(`Fecha inválida: ${value}`);
  return new Date(`${key}T00:00:00.000Z`);
}

function normalizeCodPla(value: string): string {
  const raw = value.trim();
  if (/^\d+$/.test(raw) && raw.length < 2) return raw.padStart(2, "0");
  return raw;
}

export function revisionChecklistKey(noCia: string, codPla: string, fDesde: string, fHasta: string) {
  return `${noCia}|${codPla}|${fDesde}|${fHasta}`;
}

function mapFlags(row: {
  revisada: boolean;
  generada: boolean;
  pagada: boolean;
  pagadaCk: boolean;
  pagadaDav: boolean;
  pagadaBn: boolean;
}): RevisionChecklistFlags {
  return {
    revisada: row.revisada,
    generada: row.generada,
    pagada: row.pagada,
    pagadaCk: row.pagadaCk,
    pagadaDav: row.pagadaDav,
    pagadaBn: row.pagadaBn,
  };
}

/**
 * Carga flags de checklist para un rango de quincena (clave calendario UTC).
 */
export async function loadRevisionChecklistMap(
  noCias: string[],
  fDesde: string,
  fHasta: string,
): Promise<Map<string, RevisionChecklistFlags>> {
  const desdeKey = calendarDateKey(parseDateInput(fDesde));
  const hastaKey = calendarDateKey(parseDateInput(fHasta));
  if (!desdeKey || !hastaKey || noCias.length === 0) return new Map();

  const rows = await prisma.nafNominaRevisionChecklist.findMany({
    where: { noCia: { in: noCias } },
    select: {
      noCia: true,
      codPla: true,
      fDesde: true,
      fHasta: true,
      revisada: true,
      generada: true,
      pagada: true,
      pagadaCk: true,
      pagadaDav: true,
      pagadaBn: true,
    },
  });

  const map = new Map<string, RevisionChecklistFlags>();
  for (const row of rows) {
    if (calendarDateKey(row.fDesde) !== desdeKey || calendarDateKey(row.fHasta) !== hastaKey) {
      continue;
    }
    // Compat: si solo existía el check general, reflejarlo en los tres bancos.
    const legacyAll =
      row.pagada && !row.pagadaCk && !row.pagadaDav && !row.pagadaBn
        ? { pagadaCk: true, pagadaDav: true, pagadaBn: true }
        : {
            pagadaCk: row.pagadaCk,
            pagadaDav: row.pagadaDav,
            pagadaBn: row.pagadaBn,
          };
    map.set(revisionChecklistKey(row.noCia, row.codPla, desdeKey, hastaKey), {
      revisada: row.revisada,
      generada: row.generada,
      pagada: row.pagada,
      ...legacyAll,
    });
  }
  return map;
}

export async function upsertRevisionChecklistFlag(input: {
  noCia: string;
  codPla: string;
  fDesde: string;
  fHasta: string;
  field: RevisionChecklistField;
  value: boolean;
  updatedBy?: string | null;
}): Promise<RevisionChecklistFlags> {
  const noCia = normalizeSapCode(input.noCia.trim()) ?? input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  if (!noCia || !codPla) {
    throw new Error("Parámetros requeridos: noCia, codPla, fDesde, fHasta, field, value");
  }
  const allowed: RevisionChecklistField[] = [
    "revisada",
    "generada",
    "pagada",
    "pagadaCk",
    "pagadaDav",
    "pagadaBn",
  ];
  if (!allowed.includes(input.field)) {
    throw new Error("Campo inválido. Use revisada, generada, pagadaCk, pagadaDav o pagadaBn.");
  }

  const fDesde = toDateOnly(input.fDesde);
  const fHasta = toDateOnly(input.fHasta);
  const now = new Date();

  // Pagada general → marca/desmarca los tres canales.
  if (input.field === "pagada") {
    const row = await prisma.nafNominaRevisionChecklist.upsert({
      where: { noCia_codPla_fDesde_fHasta: { noCia, codPla, fDesde, fHasta } },
      create: {
        noCia,
        codPla,
        fDesde,
        fHasta,
        revisada: false,
        generada: false,
        pagada: input.value,
        pagadaCk: input.value,
        pagadaDav: input.value,
        pagadaBn: input.value,
        pagadaAt: input.value ? now : null,
        pagadaBy: input.value ? (input.updatedBy ?? null) : null,
        updatedBy: input.updatedBy ?? null,
      },
      update: {
        pagada: input.value,
        pagadaCk: input.value,
        pagadaDav: input.value,
        pagadaBn: input.value,
        pagadaAt: input.value ? now : null,
        pagadaBy: input.value ? (input.updatedBy ?? null) : null,
        updatedBy: input.updatedBy ?? null,
      },
      select: {
        revisada: true,
        generada: true,
        pagada: true,
        pagadaCk: true,
        pagadaDav: true,
        pagadaBn: true,
      },
    });
    return mapFlags(row);
  }

  const createDefaults = {
    noCia,
    codPla,
    fDesde,
    fHasta,
    revisada: input.field === "revisada" ? input.value : false,
    generada: input.field === "generada" ? input.value : false,
    pagada: false,
    pagadaCk: input.field === "pagadaCk" ? input.value : false,
    pagadaDav: input.field === "pagadaDav" ? input.value : false,
    pagadaBn: input.field === "pagadaBn" ? input.value : false,
    updatedBy: input.updatedBy ?? null,
  };

  const updateData: Record<string, unknown> = {
    [input.field]: input.value,
    updatedBy: input.updatedBy ?? null,
  };

  const row = await prisma.nafNominaRevisionChecklist.upsert({
    where: { noCia_codPla_fDesde_fHasta: { noCia, codPla, fDesde, fHasta } },
    create: createDefaults,
    update: updateData,
    select: {
      revisada: true,
      generada: true,
      pagada: true,
      pagadaCk: true,
      pagadaDav: true,
      pagadaBn: true,
    },
  });

  return mapFlags(row);
}
