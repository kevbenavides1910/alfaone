import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Breadcrumb = {
  label: string;
  href?: string;
};

type Props = {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  className?: string;
};

export function ContractsPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: Props) {
  return (
    <header className={cn("carbon-page-header", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Ruta de navegación" className="carbon-breadcrumb mb-2">
          {breadcrumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />}
              {crumb.href ? (
                <Link href={crumb.href} className="carbon-breadcrumb-link">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[#161616]">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="carbon-page-title">{title}</h1>
          {description ? <p className="carbon-page-description mt-1">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
