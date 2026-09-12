"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-slate-600">No se pudo cargar Alfa One.</p>
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
