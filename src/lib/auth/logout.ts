/** URL de login tras cerrar sesión, siempre en el dominio actual del navegador. */
export function loginCallbackUrl(): string {
  if (typeof window === "undefined") return "/login";
  return `${window.location.origin}/login`;
}
