"use client";

import { Info, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * Ayuda visual para campos de formularios de Hacienda.
 * Muestra un ícono de info con tooltip + texto de ayuda bajo el campo.
 */
export function FieldHelp({
  text,
  error,
  valid,
  maxLength,
  currentLength,
}: {
  text?: string;
  error?: string | null;
  valid?: boolean;
  maxLength?: number;
  currentLength?: number;
}) {
  return (
    <div className="flex items-center gap-2 mt-1">
      {error ? (
        <>
          <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-500 font-medium">{error}</span>
        </>
      ) : valid ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
          <span className="text-xs text-green-600">{text}</span>
        </>
      ) : (
        <>
          <Info className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground">{text}</span>
        </>
      )}
      {maxLength && currentLength !== undefined && (
        <span className={`ml-auto text-xs tabular-nums ${currentLength > maxLength ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
          {currentLength}/{maxLength}
        </span>
      )}
    </div>
  );
}

/**
 * Etiqueta con tooltip de ayuda para Hacienda.
 */
export function LabelWithHelp({
  children,
  help,
  required,
  className,
}: {
  children: ReactNode;
  help?: string;
  required?: boolean;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-medium ${className ?? ""}`}>
        {children}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {help && (
        <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
          <Info className="h-3.5 w-3.5 text-slate-500 cursor-help" />
          {show && (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-md bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg ring-1 ring-zinc-700">
              {help}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tarjeta de error de validación para mostrar errores de Hacienda antes del envío.
 */
export function ValidationBanner({ errors, warnings }: { errors: string[]; warnings?: string[] }) {
  if (!errors.length && !warnings?.length) return null;
  return (
    <div className="space-y-1">
      {errors.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-700 dark:text-red-400">
            <p className="font-semibold mb-1">Errores que rechazaría Hacienda:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}
      {warnings && warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-400">
            <ul className="list-disc list-inside space-y-0.5">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
