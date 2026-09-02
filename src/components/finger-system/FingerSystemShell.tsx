"use client";

import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import type { PermissionKey } from "@/lib/permissions/registry";
import { Topbar } from "@/components/layout/Topbar";
import { ModuleSubnav } from "@/components/layout/ModuleSubnav";
import { Fingerprint } from "lucide-react";
import { FINGER_BRAND } from "@/modules/finger-system/config/finger.config.client";
import { useFingerCompany } from "@/components/finger-system/finger-company-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tab = {
  href: string;
  label: string;
  permission: PermissionKey;
  isActive?: (pathname: string) => boolean;
};

/** Nav diaria tipo Odoo: Relojes · Usuarios · Marcas · Asistencia · Config (+ Planillas). */
const TABS: Tab[] = [
  {
    href: "/finger-system",
    label: "Inicio",
    permission: "fingerSystem.dashboard",
    isActive: (p) => p === "/finger-system",
  },
  {
    href: "/finger-system/dispositivos",
    label: "Relojes",
    permission: "fingerSystem.dispositivos",
  },
  {
    href: "/finger-system/empleados",
    label: "Usuarios",
    permission: "fingerSystem.empleados",
    isActive: (p) =>
      p.startsWith("/finger-system/empleados") || p.startsWith("/finger-system/empresas"),
  },
  {
    href: "/finger-system/marcas",
    label: "Marcas",
    permission: "fingerSystem.marcasEnVivo",
    isActive: (p) =>
      p.startsWith("/finger-system/marcas") || p.startsWith("/finger-system/marcas-en-vivo"),
  },
  { href: "/finger-system/asistencia", label: "Asistencia", permission: "fingerSystem.asistencia" },
  { href: "/finger-system/turnos", label: "Turnos", permission: "fingerSystem.turnos" },
  { href: "/finger-system/reportes", label: "Reportes", permission: "fingerSystem.reportes" },
  {
    href: "/finger-system/configuracion",
    label: "Configuración",
    permission: "fingerSystem.configuracion",
    isActive: (p) =>
      p.startsWith("/finger-system/configuracion") ||
      p.startsWith("/finger-system/mantenimiento") ||
      p.startsWith("/finger-system/auditoria") ||
      p.startsWith("/finger-system/backups") ||
      p.startsWith("/finger-system/biometria"),
  },
];

function tabActive(tab: Tab, pathname: string): boolean {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function FingerSystemShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();
  const { companyCode, setCompanyCode, isMultiCompany, companies } = useFingerCompany();
  const visibleTabs = TABS.filter((tab) => {
    if (tab.href === "/finger-system/empleados") {
      return (
        hasPermission(session, "fingerSystem.empleados", "view") ||
        hasPermission(session, "fingerSystem.empresas", "view")
      );
    }
    return hasPermission(session, tab.permission, "view");
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Topbar
        title={FINGER_BRAND.name}
        subtitle="Biométrico · relojes ZK y padrón Odoo"
        icon={<Fingerprint className="h-5 w-5" />}
        actions={
          isMultiCompany ? (
            <Select
              value={companyCode ?? "ALL"}
              onValueChange={(v) => setCompanyCode(v === "ALL" ? "" : v)}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Compañía" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />
      <ModuleSubnav
        items={visibleTabs.map((tab) => ({
          href: tab.href,
          label: tab.label,
          active: tabActive(tab, pathname),
        }))}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
