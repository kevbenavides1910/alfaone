"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/client-session";
import { Search, Command } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SIDEBAR_NAV_ITEMS } from "@/lib/modules/navigation";
import { canAccessModule } from "@/lib/modules/access";
import { hasPermission, isPlatformAdmin } from "@/lib/permissions/check";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { data: session } = useSession();

  // Filter accessible items
  const items = useMemo(() => {
    return SIDEBAR_NAV_ITEMS.filter((item) => {
      if (!session) return false;
      if (item.adminOnly && !isPlatformAdmin(session)) return false;
      if (item.href === "/facturacion") return canAccessModule(session, "facturacion");
      if (item.href === "/contracts") return hasPermission(session, "presupuestos.contracts", "view");
      return canAccessModule(session, item.moduleId);
    });
  }, [session]);

  // Filter by query
  const results = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Reset index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard shortcut: Cmd+K or Ctrl+K + Topbar trigger
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        setQuery("");
      }
    };
    const openFromUi = () => {
      setOpen(true);
      setQuery("");
    };
    document.addEventListener("keydown", handler);
    window.addEventListener("alfa-open-command-palette", openFromUi);
    return () => {
      document.removeEventListener("keydown", handler);
      window.removeEventListener("alfa-open-command-palette", openFromUi);
    };
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      navigate(results[selectedIndex].href);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          setOpen(false);
          setQuery("");
        }}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar módulos o datos…"
            className="flex-1 border-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0"
          />
          <kbd className="hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
            <Command className="h-3 w-3" />
            <span>K</span>
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No se encontraron resultados para{" "}
              <span className="font-medium text-foreground">&ldquo;{query}&rdquo;</span>
            </div>
          ) : (
            results.map((item, index) => (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  index === selectedIndex
                    ? "bg-[color:var(--app-primary)]/10 text-foreground"
                    : "text-foreground/80 hover:bg-muted"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    index === selectedIndex
                      ? "text-[color:var(--app-primary)]"
                      : "text-muted-foreground"
                  )}
                />
                <span className="flex-1 font-medium">{item.label}</span>
                <span className="max-w-[120px] truncate text-xs text-muted-foreground">{item.href}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer tips */}
        <div className="flex items-center gap-4 border-t border-border bg-muted/50 px-4 py-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
            <span>Navegar</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[10px]">↵</kbd>
            <span>Ir</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[10px]">Esc</kbd>
            <span>Cerrar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
