"use client";

import { Suspense, useState, useEffect } from "react";
import { useSession } from "@/lib/auth/client-session";
import { useRouter } from "next/navigation";
import { useQueryTab } from "@/lib/hooks/use-query-tab";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission } from "@/lib/permissions/check";
import { ExpenseApprovalChainsTab } from "@/components/admin/ExpenseApprovalChainsTab";
import { BrandingAppearanceTab } from "@/components/admin/BrandingAppearanceTab";
import { AssetTypesTab } from "@/components/admin/AssetTypesTab";
import { ZonesTab } from "@/components/admin/ZonesTab";
import { LocationsTab } from "@/components/admin/LocationsTab";
import { PlatformNotificationsTab } from "@/components/admin/PlatformNotificationsTab";
import { ExpenseTypesTab } from "./ExpenseTypesTab";
import { OriginsTab } from "./OriginsTab";
import { CompaniesTab } from "./CompaniesTab";

type TabKey =
  | "types"
  | "approvals"
  | "origins"
  | "companies"
  | "asset-types"
  | "zones"
  | "locations"
  | "branding"
  | "notifications";

const VALID_TABS: TabKey[] = [
  "types",
  "approvals",
  "origins",
  "companies",
  "asset-types",
  "zones",
  "locations",
  "branding",
  "notifications",
];

function parseTabParam(value: string | null): TabKey {
  if (value && VALID_TABS.includes(value as TabKey)) return value as TabKey;
  return "types";
}

function CatalogsPageContent() {
  const { data: session } = useSession();
  const canEditCatalogs = session ? hasPermission(session, "plataforma.catalogs", "edit") : false;
  const readOnly = !canEditCatalogs;
  const router = useRouter();
  const tabFromUrl = parseTabParam(useQueryTab());
  const [tab, setTab] = useState<TabKey>(tabFromUrl);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const navigateTab = (key: TabKey) => {
    setTab(key);
    const href = key === "types" ? "/admin/catalogs" : `/admin/catalogs?tab=${key}`;
    router.replace(href, { scroll: false });
  };

  return (
    <>
      <Topbar title={tab === "approvals" ? "Aprobaciones" : tab === "notifications" ? "Notificaciones" : "Mantenimientos"} />
      <div className="p-6 space-y-4">
        {readOnly && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-3 text-sm text-amber-950">
              Vista de solo lectura. Solo un administrador puede modificar mantenimientos.
            </CardContent>
          </Card>
        )}
        {/* Tab switcher (Aprobaciones se accede desde el submenú superior) */}
        {tab !== "approvals" && (
        <div className="flex flex-wrap gap-1 border-b">
          {[
            { key: "types", label: "Tipos de Gasto" },
            { key: "origins", label: "Orígenes" },
            { key: "companies", label: "Empresas" },
            { key: "asset-types", label: "Tipos de Activos" },
            { key: "zones", label: "Zonas" },
            { key: "locations", label: "Ubicaciones" },
            { key: "branding",       label: "Marca y colores" },
            { key: "notifications",   label: "Notificaciones" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => navigateTab(t.key as TabKey)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? "border-[color:var(--app-primary)] text-[color:var(--app-primary)]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {tab === "types"
                ? "Tipos de Gasto"
                : tab === "approvals"
                  ? "Aprobaciones por tipo de gasto"
                  : tab === "origins"
                    ? "Orígenes de Gasto"
                    : tab === "companies"
                      ? "Empresas"
                      : tab === "asset-types"
                        ? "Tipos de Activos (inventario)"
                        : tab === "zones"
                          ? "Zonas"
                          : tab === "locations"
                            ? "Ubicaciones"
                            : tab === "notifications"
                              ? "Notificaciones"
                              : "Marca y colores"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tab === "types" ? (
              <ExpenseTypesTab readOnly={readOnly} />
            ) : tab === "approvals" ? (
              <ExpenseApprovalChainsTab readOnly={readOnly} />
            ) : tab === "origins" ? (
              <OriginsTab readOnly={readOnly} />
            ) : tab === "companies" ? (
              <CompaniesTab readOnly={readOnly} />
            ) : tab === "asset-types" ? (
              <AssetTypesTab readOnly={readOnly} />
            ) : tab === "zones" ? (
              <ZonesTab readOnly={readOnly} />
            ) : tab === "locations" ? (
              <LocationsTab readOnly={readOnly} />
            ) : tab === "notifications" ? (
              <PlatformNotificationsTab readOnly={readOnly} />
            ) : (
              <BrandingAppearanceTab readOnly={readOnly} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function CatalogsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">Cargando catálogos…</div>}>
      <CatalogsPageContent />
    </Suspense>
  );
}
