"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ModuleSubnavTab = {
  href: string;
  label: string;
  active: boolean;
  icon?: LucideIcon;
};

type Props = {
  tabs: ModuleSubnavTab[];
  ariaLabel: string;
  trailing?: ReactNode;
  /**
   * alfa — barra oscura marca Alfa (default)
   * light — barra clara con acento rojo
   * accent — gradiente personalizado (legacy)
   */
  variant?: "alfa" | "light" | "accent";
  accentClass?: string;
};

export function ModuleSubnav({
  tabs,
  ariaLabel,
  trailing,
  variant = "alfa",
  accentClass = "from-[#1a1a1a] to-[#0a0a0a] border-white/10",
}: Props) {
  if (tabs.length === 0) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "sticky top-14 lg:top-16 z-10 shrink-0",
        variant === "alfa" &&
          "border-b border-white/10 bg-[color:var(--app-sidebar)] text-white",
        variant === "light" &&
          "border-b border-border/80 bg-card/90 backdrop-blur-md shadow-sm",
        variant === "accent" && cn("border-b text-white bg-gradient-to-r", accentClass),
      )}
    >
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 md:px-5 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isAlfa = variant === "alfa" || variant === "accent";

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-150",
                variant === "light" &&
                  !tab.active &&
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
                isAlfa &&
                  !tab.active &&
                  "text-gray-300 hover:bg-white/10 hover:text-white",
                tab.active && isAlfa && "bg-red-600 text-white shadow-sm",
                tab.active && variant === "light" && "bg-primary text-primary-foreground shadow-sm",
              )}
            >
              {Icon && (
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={1.75} />
              )}
              {tab.label}
            </Link>
          );
        })}
        {trailing ? <div className="ml-auto shrink-0 py-0.5">{trailing}</div> : null}
      </div>
    </nav>
  );
}
