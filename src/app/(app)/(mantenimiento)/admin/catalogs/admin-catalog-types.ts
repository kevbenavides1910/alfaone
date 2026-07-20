// Shared types and constants for admin catalog tabs.

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ExpenseTypeConfig {
  id: string;
  type: string;
  label: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ExpenseOrigin {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CompanyCatalogRow {
  code: string;
  name: string;
  sapCode: string | null;
  isActive: boolean;
  sortOrder: number;
}

// Predefined color options for expense types
export const COLOR_OPTIONS = [
  { label: "Azul",      value: "bg-blue-100 text-blue-800" },
  { label: "Morado",    value: "bg-purple-100 text-purple-800" },
  { label: "Naranja",   value: "bg-orange-100 text-orange-800" },
  { label: "Gris azul", value: "bg-slate-100 text-slate-700" },
  { label: "Cian",      value: "bg-cyan-100 text-cyan-800" },
  { label: "Amarillo",  value: "bg-yellow-100 text-yellow-800" },
  { label: "Verde",     value: "bg-green-100 text-green-800" },
  { label: "Esmeralda", value: "bg-emerald-100 text-emerald-800" },
  { label: "Gris",      value: "bg-gray-100 text-gray-700" },
  { label: "Rojo",      value: "bg-red-100 text-red-800" },
  { label: "Rosa",      value: "bg-pink-100 text-pink-800" },
  { label: "Índigo",    value: "bg-indigo-100 text-indigo-800" },
  { label: "Lima",      value: "bg-lime-100 text-lime-800" },
];

