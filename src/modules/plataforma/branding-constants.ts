export const APP_NAME = "Syntra Dynamics";
export const APP_TAGLINE = "Control de Rentabilidad";

export const DEFAULT_PRIMARY_HEX = "#2563eb";
export const DEFAULT_SIDEBAR_HEX = "#0f172a";

export const APP_BRANDING_QUERY_KEY = ["app-branding-public"] as const;

export const APP_DOCUMENT_FOOTER = `Documento generado desde ${APP_NAME} — ${APP_TAGLINE}.`;
export const APP_DOCUMENT_FOOTER_EXTENDED = `${APP_DOCUMENT_FOOTER} Conserve este archivo para archivo disciplinario.`;

/** URL del favicon (mismo logo que marca y colores; bust de caché opcional). */
export function brandingFaviconHref(updatedAt?: string): string {
  return updatedAt ? `/icon?${encodeURIComponent(updatedAt)}` : "/icon";
}

export function brandingAppleIconHref(updatedAt?: string): string {
  return updatedAt ? `/apple-icon?${encodeURIComponent(updatedAt)}` : "/apple-icon";
}
