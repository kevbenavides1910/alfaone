"use client";

import { useEffect } from "react";

function isStaleChunkError(error: Error) {
  const msg = `${error.name} ${error.message}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
    msg,
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isStaleChunkError(error)) return;
    try {
      const key = "alfa-one:chunk-reload";
      if (sessionStorage.getItem(key) === error.message) return;
      sessionStorage.setItem(key, error.message);
    } catch {
      /* ignore */
    }
    window.location.reload();
  }, [error]);

  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-slate-600">No se pudo cargar Alfa One.</p>
          {error.message && !isStaleChunkError(error) ? (
            <p className="max-w-lg text-xs text-slate-400">{error.message}</p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            Reintentar
          </button>
          <a href="/home" className="text-sm underline">
            Ir al inicio
          </a>
          <a href="/sig" className="text-sm underline">
            Ir a SIG
          </a>
        </div>
      </body>
    </html>
  );
}
