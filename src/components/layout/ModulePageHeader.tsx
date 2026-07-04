import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

/** Encabezado estándar de página con acento de marca Alfa. */
export function ModulePageHeader({ title, description, icon: Icon, actions, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className="mt-1 h-9 w-1 shrink-0 rounded-full bg-[var(--app-primary)] shadow-sm"
          aria-hidden
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
            {Icon && (
              <Icon
                className="h-6 w-6 shrink-0 text-[var(--app-primary)]"
                strokeWidth={1.75}
              />
            )}
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1.5 max-w-3xl">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
