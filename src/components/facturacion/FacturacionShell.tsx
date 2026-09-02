"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/client-session";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils/cn";
import { hasPermission } from "@/lib/permissions/check";
import type { PermissionKey, PermissionLevelId } from "@/lib/permissions/registry";

type Tab = {
  href: string;
  label: string;
  permission: PermissionKey;
  minLevel?: PermissionLevelId;
  match: (path: string) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/facturacion",
    label: "Facturación mensual",
    permission: "facturacion.cobro",
    match: (path) => path === "/facturacion",
  },
  {
    href: "/facturacion/dashboard",
    label: "Dashboard",
    permission: "facturacion.dashboard",
    match: (path) => path.startsWith("/facturacion/dashboard"),
  },
  {
    href: "/facturacion/cuentas-por-cobrar",
    label: "Cuentas por cobrar",
    permission: "facturacion.cxc",
    match: (path) => path.startsWith("/facturacion/cuentas-por-cobrar"),
  },
  {
    href: "/facturacion/documentos-naf",
    label: "Documentos NAF",
    permission: "facturacion.documentos_naf",
    match: (path) => path.startsWith("/facturacion/documentos-naf"),
  },
  {
    href: "/facturacion/informe-ccss-ins",
    label: "Informe CCSS/INS/MNK",
    permission: "facturacion.informe_ccss_ins",
    match: (path) => path.startsWith("/facturacion/informe-ccss-ins"),
  },
  {
    href: "/facturacion/configuracion",
    label: "Configuración",
    permission: "facturacion.cxc",
    minLevel: "edit",
    match: (path) => path.startsWith("/facturacion/configuracion"),
  },
];

export function FacturacionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const canCobro = hasPermission(session, "facturacion.cobro", "view");
  const canCxc = hasPermission(session, "facturacion.cxc", "view");
  const canDashboard = hasPermission(session, "facturacion.dashboard", "view");

  useEffect(() => {
    if (pathname !== "/facturacion") return;
    if (canCobro) return;
    if (canDashboard) {
      router.replace("/facturacion/dashboard");
      return;
    }
    if (canCxc) {
      router.replace("/facturacion/cuentas-por-cobrar");
    }
  }, [pathname, canCobro, canCxc, canDashboard, router]);

  const visibleTabs = TABS.filter((tab) =>
    hasPermission(session, tab.permission, tab.minLevel ?? "view")
  );

  return (
    <>
      <Topbar title="Facturación y cobro" />
      {visibleTabs.length > 0 && (
        <nav
          aria-label="Secciones de facturación"
          className="sticky top-14 lg:top-16 z-10 border-b border-white/10 bg-[color:var(--app-sidebar)]"
        >
          <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-none">
            {visibleTabs.map((tab) => {
              const active = tab.match(pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-150",
                    active
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      {children}
    </>
  );
}
