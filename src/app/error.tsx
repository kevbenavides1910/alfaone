"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">No se pudo cargar esta pantalla.</p>
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
    </div>
  );
}
