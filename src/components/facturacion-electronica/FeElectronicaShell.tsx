"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileText, Inbox, Mail, Receipt, Settings, ShoppingCart, Wallet } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils/cn";
import { hasPermission } from "@/lib/permissions/check";
import {
  FeCompanyProvider,
  useFeCompany,
} from "@/components/facturacion-electronica/fe-company-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const TABS = [
  {
    href: "/facturacion-electronica",
    label: "Comprobantes",
    permission: "facturacionElectronica.facturas" as const,
    icon: FileText,
    match: (path: string) =>
      path === "/facturacion-electronica" ||
      path.startsWith("/facturacion-electronica/nueva") ||
      (path.startsWith("/facturacion-electronica/") &&
        !path.includes("/configuracion") &&
        !path.includes("/mensajes-receptor") &&
        !path.includes("/recibidos") &&
        !path.includes("/gastos") &&
        !path.includes("/compra") &&
        !path.includes("/recibo-pago")),
  },
  {
    href: "/facturacion-electronica/compra",
    label: "Factura compra",
    permission: "facturacionElectronica.compras" as const,
    icon: ShoppingCart,
    match: (path: string) => path.startsWith("/facturacion-electronica/compra"),
  },
  {
    href: "/facturacion-electronica/recibo-pago",
    label: "Recibo de pago",
    permission: "facturacionElectronica.recibos_pago" as const,
    icon: Receipt,
    match: (path: string) => path.startsWith("/facturacion-electronica/recibo-pago"),
  },
  {
    href: "/facturacion-electronica/recibidos",
    label: "Recibidos",
    permission: "facturacionElectronica.recibidos" as const,
    icon: Mail,
    match: (path: string) => path.startsWith("/facturacion-electronica/recibidos"),
  },
  {
    href: "/facturacion-electronica/gastos",
    label: "Gastos",
    permission: "facturacionElectronica.gastos" as const,
    icon: Wallet,
    match: (path: string) => path.startsWith("/facturacion-electronica/gastos"),
  },
  {
    href: "/facturacion-electronica/mensajes-receptor",
    label: "Mensaje receptor",
    permission: "facturacionElectronica.mensajes_receptor" as const,
    icon: Inbox,
    match: (path: string) => path.startsWith("/facturacion-electronica/mensajes-receptor"),
  },
  {
    href: "/facturacion-electronica/configuracion",
    label: "Configuración emisor",
    permission: "facturacionElectronica.config" as const,
    icon: Settings,
    match: (path: string) => path.startsWith("/facturacion-electronica/configuracion"),
  },
];

export function FeElectronicaShell({ children }: { children: React.ReactNode }) {
  return (
    <FeCompanyProvider>
      <FeElectronicaShellInner>{children}</FeElectronicaShellInner>
    </FeCompanyProvider>
  );
}

function FeElectronicaShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { companyCode, setCompanyCode, isMultiCompany, companies, needsSelection } = useFeCompany();

  const visibleTabs = TABS.filter((tab) =>
    hasPermission(session, tab.permission, "view"),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-14 lg:top-16 z-10 shrink-0 border-b border-[#2a2a2a] bg-[#121212]/95 backdrop-blur-md shadow-md">
        <div className="h-0.5 w-full bg-[var(--app-primary)]" aria-hidden />
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 md:px-6">
          <nav aria-label="Secciones FE" className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
            {visibleTabs.map((tab) => {
              const active = tab.match(pathname);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 whitespace-nowrap",
                    active
                      ? "text-white shadow-md"
                      : "text-gray-300 hover:bg-white/10 hover:text-white",
                  )}
                  style={active ? { backgroundColor: "var(--app-primary)" } : undefined}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          {isMultiCompany && (
            <div className="flex min-w-[220px] items-center gap-2 shrink-0">
              <Label htmlFor="fe-company-select" className="sr-only">
                Empresa emisora
              </Label>
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <Select value={companyCode ?? undefined} onValueChange={setCompanyCode}>
                <SelectTrigger id="fe-company-select" className="h-8 bg-background shadow-sm">
                  <SelectValue placeholder="Seleccione empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {needsSelection && (
          <p className="mt-2 text-sm text-amber-700">
            Seleccione la empresa emisora para continuar.
          </p>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
    </div>
  );
}
