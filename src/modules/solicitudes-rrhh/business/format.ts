import { format } from "date-fns";
import { es } from "date-fns/locale";

/** Formato típico CR de 9 dígitos: X-XXXX-XXXX */
export function formatCedulaDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 9) return `${d[0]}-${d.slice(1, 5)}-${d.slice(5)}`;
  return d;
}

export function maskPersonName(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "***";
  if (parts.length === 1) {
    const p = parts[0];
    return p.length <= 2 ? "***" : `${p.slice(0, 2)}***`;
  }
  return parts
    .map((p, i) => (i === parts.length - 1 ? p : `${p.slice(0, 1)}***`))
    .join(" ");
}

export function formatDateLongEs(d: Date): string {
  return format(d, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

export function formatDateShort(d: Date): string {
  return format(d, "dd/MM/yyyy");
}

/** «a los 24 días del mes de FEBRERO del 2026» */
export function formatExtensionClause(d: Date): string {
  const day = format(d, "d");
  const month = format(d, "MMMM", { locale: es }).toUpperCase();
  const year = format(d, "yyyy");
  return `a los ${day} días del mes de ${month} del ${year}`;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
