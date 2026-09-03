/**
 * Clasificación de pagos (gastos reales) — categorías y subcategorías.
 * Claves estables en BD; etiquetas para UI.
 */

export type PaymentCategoryKey =
  | "PERSONAL"
  | "OPERATIVOS"
  | "ADMINISTRATIVOS"
  | "FINANCIEROS"
  | "CUOTAS_BANCARIAS";

export type PaymentCategoryDef = {
  key: PaymentCategoryKey;
  label: string;
  subcategories: { key: string; label: string }[];
};

export const PAYMENT_CATEGORIES: PaymentCategoryDef[] = [
  {
    key: "PERSONAL",
    label: "Personal",
    subcategories: [
      { key: "PLANILLA", label: "Planilla" },
      { key: "ASOCIACION", label: "Asociación" },
      { key: "CCSS", label: "CCSS / Convenio CCSS" },
      { key: "VACACIONES", label: "Vacaciones" },
      { key: "LIQUIDACIONES", label: "Liquidaciones y Acuerdos" },
      { key: "EMBARGOS", label: "Embargos" },
      { key: "DIETAS", label: "Dietas" },
    ],
  },
  {
    key: "OPERATIVOS",
    label: "Operativos",
    subcategories: [
      { key: "AHORRO_AGUINALDOS", label: "Ahorro de aguinaldos" },
      { key: "DEVOLUCION_RESERVAS", label: "Devolución a reservas" },
      { key: "COMBUSTIBLES", label: "Combustibles" },
      { key: "GASTOS_OPERATIVOS", label: "Gastos Operativos" },
      { key: "ACTIVOS", label: "Activos" },
      { key: "PRESTAMO_DESARROLLOS", label: "Préstamo desarrollos" },
      { key: "MATERIALES_FINCA", label: "Materiales Finca" },
      { key: "ALQUILERES", label: "Alquileres" },
      { key: "INFRAESTRUCTURA", label: "Infraestructura" },
      { key: "PSICOLOGICOS", label: "Psicológicos" },
      { key: "IMPREVISTOS", label: "Imprevistos" },
      { key: "PROVEEDORES", label: "Proveedores" },
      { key: "UNIFORMES", label: "Uniformes" },
    ],
  },
  {
    key: "ADMINISTRATIVOS",
    label: "Administrativos",
    subcategories: [
      { key: "SERVICIOS_PROFESIONALES", label: "Servicios Profesionales" },
      { key: "SERVICIOS_PUBLICOS", label: "Servicios Públicos" },
      { key: "GARANTIAS", label: "Garantías" },
      { key: "DONACIONES", label: "Donaciones" },
      { key: "TARJETAS_CREDITO", label: "Tarjetas de crédito" },
      { key: "PATENTES", label: "Patentes" },
      { key: "IVA", label: "IVA" },
      { key: "POLIZAS", label: "Pólizas" },
      { key: "RENTA", label: "Renta" },
    ],
  },
  {
    key: "FINANCIEROS",
    label: "Financieros",
    subcategories: [
      { key: "INTERESES_CUOTAS", label: "Intereses de Cuotas Bancarias" },
    ],
  },
  {
    key: "CUOTAS_BANCARIAS",
    label: "Cuotas bancarias",
    subcategories: [
      { key: "CUOTAS", label: "Cuotas" },
    ],
  },
];

const categoryByKey = new Map(PAYMENT_CATEGORIES.map((c) => [c.key, c]));

export function paymentCategoryLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return categoryByKey.get(key as PaymentCategoryKey)?.label ?? key;
}

export function paymentSubcategoryLabel(
  categoryKey: string | null | undefined,
  subcategoryKey: string | null | undefined,
): string | null {
  if (!categoryKey || !subcategoryKey) return null;
  const cat = categoryByKey.get(categoryKey as PaymentCategoryKey);
  return cat?.subcategories.find((s) => s.key === subcategoryKey)?.label ?? subcategoryKey;
}

export function subcategoriesFor(categoryKey: string | null | undefined) {
  if (!categoryKey) return [];
  return categoryByKey.get(categoryKey as PaymentCategoryKey)?.subcategories ?? [];
}

/** Valida par categoría/subcategoría. Permite ambos null (sin clasificar). */
export function validatePaymentClassification(
  category: string | null | undefined,
  subcategory: string | null | undefined,
): { ok: true; category: string | null; subcategory: string | null } | { ok: false; message: string } {
  const cat = category?.trim() || null;
  const sub = subcategory?.trim() || null;
  if (!cat && !sub) return { ok: true, category: null, subcategory: null };
  if (!cat) return { ok: false, message: "Indicá la categoría" };
  if (!sub) return { ok: false, message: "Indicá la subcategoría" };
  const def = categoryByKey.get(cat as PaymentCategoryKey);
  if (!def) return { ok: false, message: "Categoría inválida" };
  if (!def.subcategories.some((s) => s.key === sub)) {
    return { ok: false, message: "La subcategoría no pertenece a esa categoría" };
  }
  return { ok: true, category: cat, subcategory: sub };
}
