import { cn } from "@/lib/utils/cn";

interface Props {
  children: React.ReactNode;
  className?: string;
  /** Ancho amplio para tablas y dashboards. */
  wide?: boolean;
}

/** Contenedor estándar de contenido de módulo. */
export function ModulePage({ children, className, wide }: Props) {
  return (
    <div
      className={cn(
        "p-6 md:p-8 space-y-6 mx-auto w-full",
        wide ? "max-w-[1400px]" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
