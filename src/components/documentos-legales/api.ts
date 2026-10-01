export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = payload as { message?: unknown; error?: { message?: unknown } } | null;
    const message =
      typeof body?.error?.message === "string"
        ? body.error.message
        : typeof body?.message === "string"
          ? body.message
          : "No se pudo completar la operación";
    throw new Error(message);
  }
  return (payload as { data: T }).data;
}

export function monthQuery(month: string, companies: string[]): string {
  const params = new URLSearchParams({ month });
  for (const company of companies) params.append("company", company);
  return params.toString();
}
