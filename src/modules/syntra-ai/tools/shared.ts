import type { Session } from "next-auth";
import {
  listNafNominaEmpresas,
} from "@/modules/empleados-naf/services/list-nomina";
import { listRevisionPlanillaEmpresas } from "@/modules/empleados-naf/services/revision-planilla";

export const MAX_LIST = 25;

export function isoDate(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function strArg(args: Record<string, unknown>, key: string): string {
  return typeof args[key] === "string" ? (args[key] as string).trim() : "";
}

export function intArg(args: Record<string, unknown>, key: string, fallback: number, max?: number): number {
  const n = typeof args[key] === "number" ? args[key] : fallback;
  return max != null ? Math.min(n, max) : n;
}

export async function resolveNoCias(session: Session, noCias?: string[]): Promise<string[]> {
  const empresas = await listNafNominaEmpresas();
  const allowed = new Set(empresas.map((e) => e.noCia));
  if (noCias?.length) {
    return noCias.filter((n) => allowed.has(n.trim())).slice(0, 10);
  }
  const company = session.user.company;
  if (company) {
    return empresas.filter((e) => e.companyCode === company).map((e) => e.noCia);
  }
  return empresas.map((e) => e.noCia);
}

export async function resolveRevisionNoCias(session: Session, noCias?: string[]): Promise<string[]> {
  const empresas = await listRevisionPlanillaEmpresas();
  const allowed = new Set(empresas.map((e) => e.noCia));
  if (noCias?.length) {
    return noCias.filter((n) => allowed.has(n.trim())).slice(0, 10);
  }
  const company = session.user.company;
  if (company) {
    return empresas.filter((e) => e.companyCode === company).map((e) => e.noCia);
  }
  return empresas.map((e) => e.noCia);
}

export function currentYearMonth(): { year: number; month: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return { year, month };
}
