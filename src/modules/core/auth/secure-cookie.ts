/** Host de acceso directo (IP o loopback), sin el dominio público de NEXTAUTH_URL. */
export function isDirectIpHost(host: string | null | undefined): boolean {
  const raw = (host ?? "").trim().toLowerCase();
  if (!raw) return false;

  let hostname = raw;
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    hostname = end > 1 ? raw.slice(1, end) : raw;
  } else {
    hostname = raw.split(":")[0] ?? raw;
  }

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

/**
 * Cookie `Secure` solo cuando el navegador puede guardarla.
 * El dominio público (NEXTAUTH_URL https) la usa. En http://IP:3000 el navegador
 * descarta `__Secure-` / `Secure` y el login vuelve a /login.
 */
export function secureCookieForRequest(
  host: string | null | undefined,
  forwardedProto: string | null | undefined,
): boolean {
  if (isDirectIpHost(host)) {
    const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase();
    return proto === "https";
  }
  const url = process.env.NEXTAUTH_URL?.trim().toLowerCase() ?? "";
  return url.startsWith("https://");
}
