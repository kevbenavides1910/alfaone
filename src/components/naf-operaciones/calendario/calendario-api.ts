import type {
  CalendarioContractOption,
  CalendarioEventTypeOption,
  CalendarioUserRef,
  CalendarioZoneRef,
} from "@/modules/naf-operaciones/business/calendario-types";

export const CALENDARIO_API = "/api/naf-operaciones/calendario";
export const CALENDARIO_TIPOS_ADMIN_HREF = "/admin/catalogs?tab=event-types";

export type CalendarioOpciones = {
  zones: CalendarioZoneRef[];
  types: CalendarioEventTypeOption[];
  admins: CalendarioUserRef[];
  contracts: CalendarioContractOption[];
};

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? `Error ${res.status}`);
  return body.data as T;
}

export async function calendarioFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return parseResponse<T>(res);
}

/** Multipart: el navegador arma el boundary, no se fija Content-Type. */
export async function calendarioUpload<T>(url: string, form: FormData): Promise<T> {
  return parseResponse<T>(await fetch(url, { method: "POST", body: form }));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
