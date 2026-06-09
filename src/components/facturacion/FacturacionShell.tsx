"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils/cn";
import { hasPermission } from "@/lib/permissions/check";

const TABS = [
  {
    href: "/facturacion",
    label: "Facturación mensual",
    permission: "facturacion.cobro" as const,
    match: (path: string) => path === "/facturacion",
  },
  {
    href: "/facturacion/cuentas-por-cobrar",
    label: "Cuentas por cobrar",
    permission: "facturacion.cxc" as const,
    match: (path: string) => path.startsWith("/facturacion/cuentas-por-cobrar"),
  },
  {
    href: "/facturacion/configuracion",
    label: "Configuración",
    permission: "facturacion.cxc" as const,
    match: (path: string) => path.startsWith("/facturacion/configuracion"),
    minLevel: "edit" as const,
  },
];

export function FacturacionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const canCobro = hasPermission(session, "facturacion.cobro", "view");
  const canCxc = hasPermission(session, "facturacion.cxc", "view");

  useEffect(() => {
    if (pathname === "/facturacion" && !canCobro && canCxc) {
      router.replace("/facturacion/cuentas-por-cobrar");
    }
  }, [pathname, canCobro, canCxc, router]);

  const visibleTabs = TABS.filter((tab) => {
    const level = "minLevel" in tab && tab.minLevel ? tab.minLevel : "view";
    return hasPermission(session, tab.permission, level);
  });

  return (
    <>
      <Topbar title="Facturación y cobro" />
      {visibleTabs.length > 1 && (
        <nav
          aria-label="Secciones de facturación"
          className="border-b border-slate-200 bg-white px-4 md:px-6"
        >
          <div className="flex gap-1 overflow-x-auto">
            {visibleTabs.map((tab) => {
              const active = tab.match(pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                    active
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
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
