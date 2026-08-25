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

const TABS: Tab[] = [
  {
    href: "/finger-system",
    label: "Dashboard",
    permission: "fingerSystem.dashboard",
    isActive: (p) => p === "/finger-system",
  },
  {
    href: "/finger-system/empleados",
    label: "Lista Empleados",
    permission: "fingerSystem.empleados",
    isActive: (p) => p.startsWith("/finger-system/empleados") || p.startsWith("/finger-system/empresas"),
  },
  { href: "/finger-system/biometria", label: "Biometría", permission: "fingerSystem.biometria" },
  { href: "/finger-system/dispositivos", label: "Dispositivos", permission: "fingerSystem.dispositivos" },
  {
    href: "/finger-system/marcas-en-vivo",
    label: "Marcas en vivo",
    permission: "fingerSystem.marcasEnVivo",
  },
  { href: "/finger-system/asistencia", label: "Asistencia", permission: "fingerSystem.asistencia" },
  { href: "/finger-system/turnos", label: "Turnos", permission: "fingerSystem.turnos" },
  { href: "/finger-system/reportes", label: "Reportes", permission: "fingerSystem.reportes" },
  { href: "/finger-system/backups", label: "Backups", permission: "fingerSystem.backups" },
  {
    href: "/finger-system/mantenimiento",
    label: "Mantenimiento",
    permission: "fingerSystem.mantenimiento",
  },
  { href: "/finger-system/auditoria", label: "Auditoría", permission: "fingerSystem.auditoria" },
  {
    href: "/finger-system/configuracion",
    label: "Configuración",
    permission: "fingerSystem.configuracion",
    isActive: (p) => p.startsWith("/finger-system/configuracion"),
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

  const selectCompanyValue =
    companyCode && companies.some((c) => c.code === companyCode) ? companyCode : undefined;

  return (
    <>
      <Topbar
        title={
          <span className="inline-flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-teal-600" />
            {FINGER_BRAND.name}
          </span>
        }
      />
      {visibleTabs.length > 1 && (
        <ModuleSubnav
          ariaLabel="Secciones Finger System"
          tabs={visibleTabs.map((tab) => ({
            href: tab.href,
            label: tab.label,
            active: tabActive(tab, pathname),
          }))}
          trailing={
            isMultiCompany && companies.length > 1 ? (
              <Select value={selectCompanyValue} onValueChange={setCompanyCode}>
                <SelectTrigger className="h-8 w-[10rem] text-xs">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null
          }
        />
      )}
      <main className="min-w-0">{children}</main>
    </>
  );
}
