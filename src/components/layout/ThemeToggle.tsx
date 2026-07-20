"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTheme } from "@/lib/theme/theme-context";

/** Interruptor global de tema claro/oscuro */
export function ThemeToggle({ className }: { className?: string }) {
  const { isDark, toggleTheme, mounted } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Desactivar modo oscuro" : "Activar modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isDark
          ? "border-zinc-600 bg-zinc-800"
          : "border-gray-200 bg-gray-100",
        !mounted && "opacity-0 pointer-events-none",
        className
      )}
    >
      <span
        className={cn(
          "absolute flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-all duration-200",
          isDark
            ? "translate-x-7 bg-zinc-700 text-amber-300"
            : "translate-x-1 bg-white text-[color:var(--app-primary)]"
        )}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
