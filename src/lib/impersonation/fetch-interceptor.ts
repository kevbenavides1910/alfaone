const IMPERSONATION_HEADER = "x-impersonation-token";

let installed = false;

/** Añade X-Impersonation-Token a fetch same-origin cuando hay vista previa activa. */
export function installImpersonationFetchInterceptor(getToken: () => string | null) {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const token = getToken();
    if (!token) return originalFetch(input, init);

    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const isSameOrigin =
      url.startsWith("/") ||
      (typeof window !== "undefined" && url.startsWith(window.location.origin));

    if (!isSameOrigin) return originalFetch(input, init);

    if (input instanceof Request) {
      const headers = new Headers(input.headers);
      if (!headers.has(IMPERSONATION_HEADER)) {
        headers.set(IMPERSONATION_HEADER, token);
      }
      const nextInit: RequestInit = { ...init, headers };
      return originalFetch(new Request(input, nextInit));
    }

    const headers = new Headers(init?.headers);
    if (!headers.has(IMPERSONATION_HEADER)) {
      headers.set(IMPERSONATION_HEADER, token);
    }
    return originalFetch(input, { ...init, headers });
  };
}

export { IMPERSONATION_HEADER };
