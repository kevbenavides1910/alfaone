"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, LayoutGrid, LogOut, Shield, Menu, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { loginCallbackUrl } from "@/lib/auth/logout";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  APP_BRANDING_QUERY_KEY, APP_NAME,
  DEFAULT_PRIMARY_HEX,
} from "@/modules/plataforma/branding-constants";

interface TopbarProps { title?: string; }

export function Topbar({ title }: TopbarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const onHome = pathname === "/home";
  const [mobileOpen, setMobileOpen] = useState(false);
  const impersonating = Boolean(session?.user?.impersonatorId);

  const stopImpersonation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/auth/stop-impersonate", {
        method: "POST",
        credentials: "same-origin",
      });
      const text = await r.text();
      const body = text.trim() ? JSON.parse(text) : {};
      if (!r.ok) {
        throw new Error(body?.error?.message ?? `Error ${r.status}`);
      }
      return body as { data?: { redirectTo?: string } };
    },
    onSuccess: (res) => {
      window.location.assign(res.data?.redirectTo ?? "/admin/users");
    },
  });

  const { data: brand } = useQuery({
    queryKey: APP_BRANDING_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/branding");
      const j = (await r.json()) as { data?: { primaryHex: string; sidebarHex: string; hasLogo: boolean; updatedAt: string } };
      if (!r.ok || !j.data) return { primaryHex: "", sidebarHex: "", hasLogo: false, updatedAt: "" };
      return j.data;
    },
    staleTime: 30_000,
  });

  const primary = brand?.primaryHex ?? "#2563eb";
  const logoSrc = brand?.hasLogo && brand.updatedAt ? `/api/branding/logo?${encodeURIComponent(brand.updatedAt)}` : null;

  return (
    <>
      {impersonating && (
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <div className="flex items-center gap-2 min-w-0">
            <UserRound className="h-4 w-4 shrink-0" />
            <span className="truncate">
              Ingresó como <strong>{session?.user?.name}</strong>
              {session?.user?.impersonatorName ? (
                <> · administrador: {session.user.impersonatorName}</>
              ) : null}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-300 bg-white hover:bg-amber-100"
            disabled={stopImpersonation.isPending}
            onClick={() => stopImpersonation.mutate()}
          >
            Volver a mi cuenta
          </Button>
        </div>
      )}
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <div className={`fixed left-0 top-0 z-50 h-full w-64 md:hidden transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} isMobile />
      </div>

      <header className={cn(
        "h-16 border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-20",
        onHome ? "bg-[#161616] border-[#393939] text-white shadow-md" : "border-border bg-card/90 backdrop-blur-md shadow-sm"
      )}>
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger mobile */}
          <button type="button" className="md:hidden flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100 transition-colors shrink-0"
            onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
            <Menu className="h-5 w-5" style={{ color: onHome ? '#fff' : '#475569' }} />
          </button>

          <Link href="/home" className={cn("flex items-center gap-2.5 shrink-0 rounded-lg pr-2 py-1 transition-colors", onHome ? "hover:bg-white/10" : "hover:bg-muted")} title="Volver al inicio">
            <div className="rounded-lg p-1.5 flex items-center justify-center w-9 h-9" style={{ backgroundColor: primary }}>
              {logoSrc ? <img src={logoSrc} alt="" className="max-h-6 max-w-6 object-contain" /> : <Shield className="h-4 w-4 text-white" />}
            </div>
            <span className={cn("hidden sm:block font-semibold text-sm", onHome ? "text-white" : "text-slate-800")}>{APP_NAME}</span>
          </Link>

          {!onHome && (<><span className="text-slate-300 hidden sm:inline">/</span><Link href="/home" className="hidden sm:inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors shrink-0"><LayoutGrid className="h-4 w-4" />Inicio</Link>{title && (<><span className="text-slate-300 hidden md:inline">/</span><span className="font-semibold text-slate-800 truncate text-sm md:text-base">{title}</span></>)}</>)}
          {onHome && <span className="font-semibold text-lg text-white">{title ?? "Inicio"}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("hidden md:block text-xs truncate max-w-[140px]", onHome ? "text-white/70" : "text-slate-500")}>{session?.user?.name}</span>
          <Bell className={cn("h-5 w-5", onHome ? "text-white hover:bg-white/10 hover:text-white" : "text-slate-500")} />
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: loginCallbackUrl() })} className={cn("gap-2", onHome ? "text-white hover:bg-white/10 hover:text-white" : "text-slate-600")}>
            <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>
    </>
  );
}
