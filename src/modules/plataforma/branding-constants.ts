export const APP_NAME = "Alfa One";
export const APP_TAGLINE = "Plataforma de gestión empresarial";

export const DEFAULT_PRIMARY_HEX = "#dc2626";
export const DEFAULT_SIDEBAR_HEX = "#111111";

export const APP_BRANDING_QUERY_KEY = ["app-branding-public"] as const;

export const APP_DOCUMENT_FOOTER = `Documento generado desde ${APP_NAME}.`;
export const APP_DOCUMENT_FOOTER_EXTENDED = `${APP_DOCUMENT_FOOTER} Conserve este archivo para archivo disciplinario.`;

/** URL del favicon (mismo logo que marca y colores; bust de caché opcional). */
export function brandingFaviconHref(updatedAt?: string): string {
  return updatedAt ? `/icon?${encodeURIComponent(updatedAt)}` : "/icon";
}

export function brandingAppleIconHref(updatedAt?: string): string {
  return updatedAt ? `/apple-icon?${encodeURIComponent(updatedAt)}` : "/apple-icon";
}
