import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type FeReadiness = {
  emisor: boolean;
  certificado: boolean;
  atv: boolean;
  sucursal: boolean;
  puntoVenta: boolean;
  readyToEmit: boolean;
};

const STEPS: Array<{ key: keyof Omit<FeReadiness, "readyToEmit">; label: string }> = [
  { key: "emisor", label: "Datos del emisor" },
  { key: "certificado", label: "Certificado .p12" },
  { key: "atv", label: "Credenciales ATV" },
  { key: "sucursal", label: "Sucursal" },
  { key: "puntoVenta", label: "Punto de venta" },
];

export function FeConfigChecklist({ readiness }: { readiness: FeReadiness }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {STEPS.map((step, i) => {
        const done = readiness[step.key];
        return (
          <li
            key={step.key}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
              done ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-border bg-muted/30"
            )}
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span>
              <span className="mr-1 font-mono text-xs text-muted-foreground">{i + 1}.</span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
