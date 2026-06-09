"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
      if (item.href === "/contracts") return hasPermission(session, "alfa-one.contracts", "view");
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

  // Keyboard shortcut: Cmd+K or Ctrl+K
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
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
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
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar módulos..."
            className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 bg-transparent border-none outline-none focus:outline-none focus:ring-0"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            <Command className="h-3 w-3" />
            <span>K</span>
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-400">
              No se encontraron resultados para <span className="font-medium text-slate-600">&ldquo;{query}&rdquo;</span>
            </div>
          ) : (
            results.map((item, index) => (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors",
                  index === selectedIndex
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4 shrink-0",
                  index === selectedIndex ? "text-blue-600" : "text-slate-400"
                )} />
                <span className="flex-1 font-medium">{item.label}</span>
                <span className="text-xs text-slate-400 truncate max-w-[120px]">{item.href}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer tips */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
            <span>Navegar</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[10px]">↵</kbd>
            <span>Ir</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[10px]">Esc</kbd>
            <span>Cerrar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
