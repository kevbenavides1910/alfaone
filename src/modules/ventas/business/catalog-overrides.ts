import type { CatalogSection } from "../validations/parametros.schema";

/** Overrides + líneas agregadas/excluidas (persistido en catalogOverrides del presupuesto). */
export type CatalogOverrides = {
  salarios?: Record<string, { valoresPorAnio?: Record<string, number> }>;
  jornadas?: Record<
    string,
    { salarioBaseMensual?: number; costoHoraOrdinaria?: number; costoMoReferencia?: number }
  >;
  cargasSociales?: Record<string, { porcentaje?: number }>;
  pagosExtras?: Record<string, { valor?: number }>;
  insumos?: Record<string, { costoUnitario?: number }>;
  gastosAdmin?: Record<string, { montoMensual?: number }>;
  indices?: Record<string, { valor?: number }>;
  _excluded?: Partial<Record<CatalogSection, string[]>>;
  _added?: Partial<Record<CatalogSection, Array<Record<string, unknown>>>>;
};

export type CatalogLineMeta = {
  modificados: string[];
  agregados: string[];
  excluidos: string[];
};

export type CatalogLineMetaBySection = Record<CatalogSection, CatalogLineMeta>;

const SECTIONS: CatalogSection[] = [
  "salarios",
  "jornadas",
  "cargasSociales",
  "pagosExtras",
  "insumos",
  "gastosAdmin",
  "indices",
];

function dec(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || 0;
}

export function parseCatalogOverrides(raw: unknown): CatalogOverrides {
  if (!raw || typeof raw !== "object") return {};
  return raw as CatalogOverrides;
}

export function fieldOverridesOnly(raw: CatalogOverrides): CatalogOverrides {
  const { _excluded, _added, ...rest } = raw;
  return rest;
}

export function listModifiedCatalogKeys(overrides: CatalogOverrides): CatalogLineMetaBySection {
  const fields = fieldOverridesOnly(overrides);
  const empty = (): CatalogLineMeta => ({ modificados: [], agregados: [], excluidos: [] });
  const out = Object.fromEntries(SECTIONS.map((s) => [s, empty()])) as CatalogLineMetaBySection;

  for (const section of SECTIONS) {
    const sectionOverrides = fields[section as keyof typeof fields];
    if (sectionOverrides && typeof sectionOverrides === "object") {
      out[section].modificados = Object.keys(sectionOverrides as object);
    }
    out[section].agregados = (overrides._added?.[section] ?? []).map((x) => String(x.codigo ?? ""));
    out[section].excluidos = [...(overrides._excluded?.[section] ?? [])];
  }
  return out;
}

export function mergeCatalogForPresupuesto<
  T extends {
    salarios: Array<{ codigo: string; valoresPorAnio: Record<string, number> }>;
    jornadas: Array<{
      codigo: string;
      nombre?: string;
      salarioBaseMensual: unknown;
      costoHoraOrdinaria: unknown;
      costoMoReferencia: unknown;
    }>;
    cargasSociales: Array<{ codigo: string; nombre?: string; porcentaje: unknown; grupo?: string }>;
    pagosExtras: Array<{ codigo: string; nombre?: string; tipo?: string; valor: unknown }>;
    insumos: Array<{ codigo: string; nombre?: string; categoria?: string; costoUnitario: unknown; equipamientos?: string[] }>;
    gastosAdmin: Array<{ codigo: string; nombre?: string; montoMensual: unknown }>;
    indices: Array<{ codigo: string; nombre?: string; valor?: unknown }>;
    insumoVariantes?: unknown[];
    gaTotalMensual?: number;
  },
>(catalog: T, customization: CatalogOverrides): T {
  const fields = fieldOverridesOnly(customization);
  const excluded = customization._excluded ?? {};
  const added = customization._added ?? {};

  const filterExcluded = <R extends { codigo: string }>(section: CatalogSection, rows: R[]) =>
    rows.filter((r) => !(excluded[section] ?? []).includes(r.codigo));

  const appendAdded = <R extends { codigo: string }>(section: CatalogSection, rows: R[]) => {
    const extra = (added[section] ?? []) as R[];
    return [...rows, ...extra];
  };

  return {
    ...catalog,
    salarios: appendAdded(
      "salarios",
      filterExcluded(
        "salarios",
        catalog.salarios.map((s) => {
          const patch = fields.salarios?.[s.codigo];
          if (!patch?.valoresPorAnio) return s;
          return { ...s, valoresPorAnio: { ...s.valoresPorAnio, ...patch.valoresPorAnio } };
        })
      )
    ),
    jornadas: appendAdded(
      "jornadas",
      filterExcluded(
        "jornadas",
        catalog.jornadas.map((j) => {
          const patch = fields.jornadas?.[j.codigo];
          if (!patch) return j;
          return {
            ...j,
            salarioBaseMensual: patch.salarioBaseMensual ?? j.salarioBaseMensual,
            costoHoraOrdinaria: patch.costoHoraOrdinaria ?? j.costoHoraOrdinaria,
            costoMoReferencia: patch.costoMoReferencia ?? j.costoMoReferencia,
          };
        })
      )
    ),
    cargasSociales: appendAdded(
      "cargasSociales",
      filterExcluded(
        "cargasSociales",
        catalog.cargasSociales.map((c) => {
          const patch = fields.cargasSociales?.[c.codigo];
          if (patch?.porcentaje == null) return c;
          return { ...c, porcentaje: patch.porcentaje };
        })
      )
    ),
    pagosExtras: appendAdded(
      "pagosExtras",
      filterExcluded(
        "pagosExtras",
        catalog.pagosExtras.map((p) => {
          const patch = fields.pagosExtras?.[p.codigo];
          if (patch?.valor == null) return p;
          return { ...p, valor: patch.valor };
        })
      )
    ),
    insumos: appendAdded(
      "insumos",
      filterExcluded(
        "insumos",
        catalog.insumos.map((i) => {
          const patch = fields.insumos?.[i.codigo];
          if (patch?.costoUnitario == null) return i;
          return { ...i, costoUnitario: patch.costoUnitario };
        })
      )
    ),
    gastosAdmin: appendAdded(
      "gastosAdmin",
      filterExcluded(
        "gastosAdmin",
        catalog.gastosAdmin.map((g) => {
          const patch = fields.gastosAdmin?.[g.codigo];
          if (patch?.montoMensual == null) return g;
          return { ...g, montoMensual: patch.montoMensual };
        })
      )
    ),
    indices: appendAdded(
      "indices",
      filterExcluded(
        "indices",
        catalog.indices.map((idx) => {
          const patch = fields.indices?.[idx.codigo];
          if (patch?.valor == null) return idx;
          return { ...idx, valor: patch.valor };
        })
      )
    ),
  };
}

export function gaTotalFromCatalog(gastosAdmin: Array<{ montoMensual: unknown }>): number {
  return gastosAdmin.reduce((s, g) => s + dec(g.montoMensual), 0);
}

export function buildCatalogOverridesFromEdits(
  current: CatalogOverrides,
  section: CatalogSection,
  codigo: string,
  field: string,
  value: number | Record<string, number> | null,
  globalValue: number | Record<string, number>
): CatalogOverrides {
  const next = structuredClone(current);
  const fields = fieldOverridesOnly(next);
  const sectionMap = { ...(fields[section] ?? {}) } as Record<string, Record<string, unknown>>;

  if (value == null || valuesEqual(value, globalValue)) {
    if (sectionMap[codigo]) {
      const item = { ...sectionMap[codigo] };
      delete item[field];
      if (Object.keys(item).length === 0) delete sectionMap[codigo];
      else sectionMap[codigo] = item;
    }
  } else {
    sectionMap[codigo] = { ...(sectionMap[codigo] ?? {}), [field]: value };
  }

  if (Object.keys(sectionMap).length === 0) {
    delete fields[section];
  } else {
    fields[section] = sectionMap as CatalogOverrides[typeof section];
  }

  return { ...next, ...fields };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return Math.abs(dec(a) - dec(b)) < 0.0001;
}

export function generateCatalogCodigo(section: CatalogSection): string {
  const prefix = section.replace(/([A-Z])/g, "_$1").toUpperCase().replace(/^_/, "").slice(0, 6);
  return `${prefix}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

export type ParametrosGenerales = {
  compania: string;
  anioBase: number;
  polizaInsPct: number;
  ivaPct: number;
  margenUtilidadPct: number;
  imprevistosPct: number;
};

export function parametrosModificados(
  presupuesto: ParametrosGenerales,
  defaults: ParametrosGenerales
): Partial<Record<keyof ParametrosGenerales, boolean>> {
  const keys = [
    "compania",
    "anioBase",
    "polizaInsPct",
    "ivaPct",
    "margenUtilidadPct",
    "imprevistosPct",
  ] as const;
  const out: Partial<Record<keyof ParametrosGenerales, boolean>> = {};
  for (const k of keys) {
    if (k === "compania" || k === "anioBase") {
      if (presupuesto[k] !== defaults[k]) out[k] = true;
    } else if (Math.abs(presupuesto[k] - defaults[k]) >= 0.0001) {
      out[k] = true;
    }
  }
  return out;
}
