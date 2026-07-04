/** Parsea JSON de fetch; si la respuesta es HTML (error nginx/Next), devuelve mensaje legible. */
export async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return {} as T;
  }
  if (trimmed.startsWith("<")) {
    throw new Error(
      res.ok
        ? "El servidor respondió HTML en lugar de JSON. Recargue e intente de nuevo."
        : `Error del servidor (${res.status}). Recargue e intente de nuevo.`
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`Respuesta no válida del servidor (${res.status}).`);
  }
}
