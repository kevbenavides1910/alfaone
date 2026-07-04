import { DEFAULT_SIDEBAR_HEX } from "@/modules/plataforma/branding-constants";

/** Tonos azulados heredados que no combinan con la shell oscura Alfa. */
const LEGACY_SIDEBAR_HEX = new Set([
  "#0f172a",
  "#1e293b",
  "#1a1f2e",
  "#111827",
  "#172554",
  "#0c1222",
]);

/**
 * Normaliza el color del sidebar al negro/carbón de la shell (topbar + subnav).
 */
export function normalizeSidebarHex(hex: string | null | undefined): string {
  const trimmed = hex?.trim();
  if (!trimmed) return DEFAULT_SIDEBAR_HEX;

  const normalized = trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
  if (LEGACY_SIDEBAR_HEX.has(normalized)) return DEFAULT_SIDEBAR_HEX;

  return normalized;
}
