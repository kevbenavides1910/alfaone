import type {
  CalendarioContractOption,
  CalendarioEventTypeOption,
  CalendarioZoneRef,
} from "@/modules/naf-operaciones/business/calendario-types";

export const CALENDARIO_API = "/api/naf-operaciones/calendario";
export const CALENDARIO_TIPOS_ADMIN_HREF = "/admin/catalogs?tab=event-types";

export type CalendarioOpciones = {
  zones: CalendarioZoneRef[];
  types: CalendarioEventTypeOption[];
  contracts: CalendarioContractOption[];
};

export async function calendarioFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? `Error ${res.status}`);
  return body.data as T;
}

export const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
