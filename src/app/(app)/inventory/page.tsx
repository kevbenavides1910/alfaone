"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth/client-session";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Package, History, MapPin, RotateCcw,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { canManageExpenses } from "@/modules/core/permissions";
import {
  type AssetType, type AssetRow, type MovementRow,
} from "./inventory-types";
import { AssetsTable } from "@/components/inventory/AssetsTable";
import { MovementsTable } from "@/components/inventory/MovementsTable";
import { IntakeDialog } from "@/components/inventory/IntakeDialog";
import { IssueDialog } from "@/components/inventory/IssueDialog";
import { ReturnDialog } from "@/components/inventory/ReturnDialog";
import { EditAssetDialog } from "@/components/inventory/EditAssetDialog";
import { AssignFromStockDialog } from "@/components/inventory/AssignFromStockDialog";

export default function InventoryPage() {
  const { data: session } = useSession();
  const canManage = canManageExpenses(session ?? null);

  const [tab, setTab] = useState<"stock" | "assigned" | "pending" | "movements">("stock");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [searchQ, setSearchQ] = useState("");

  const qc = useQueryClient();

  const { data: typesRes } = useQuery<{ data: AssetType[] }>({
    queryKey: ["asset-types"],
    queryFn: () => fetch("/api/admin/catalogs/asset-types").then((r) => r.json()),
  });
  const types = typesRes?.data ?? [];
  const activeTypes = types.filter((t) => t.isActive);

  // Conteo de "Pendientes de devolución" para mostrar el badge en la pestaña.
  const { data: pendingCountRes } = useQuery<{ data: AssetRow[] }>({
    queryKey: ["assets", { status: "PENDING_RETURN", forBadge: true }],
    queryFn: () => fetch("/api/assets?status=PENDING_RETURN").then((r) => r.json()),
    refetchInterval: 60000,
  });
  const pendingCount = pendingCountRes?.data?.length ?? 0;

  const statusForTab =
    tab === "stock" ? "IN_STOCK"
    : tab === "assigned" ? "ASSIGNED"
    : tab === "pending" ? "PENDING_RETURN"
    : null;

  const assetsQueryKey = ["assets", { status: statusForTab, typeId: typeFilter, q: searchQ }];
  const { data: assetsRes, isLoading: assetsLoading } = useQuery<{ data: AssetRow[] }>({
    queryKey: assetsQueryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusForTab) params.set("status", statusForTab);
      if (typeFilter) params.set("typeId", typeFilter);
      if (searchQ) params.set("q", searchQ);
      return fetch(`/api/assets?${params}`).then((r) => r.json());
    },
    enabled: tab !== "movements",
  });
  const assets = assetsRes?.data ?? [];

  const { data: movementsRes, isLoading: movementsLoading } = useQuery<{ data: MovementRow[] }>({
    queryKey: ["asset-movements", { typeId: typeFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set("typeId", typeFilter);
      return fetch(`/api/asset-movements?${params}`).then((r) => r.json());
    },
    enabled: tab === "movements",
  });
  const movements = movementsRes?.data ?? [];

  const [intakeOpen, setIntakeOpen] = useState(false);
  const [issueFor, setIssueFor] = useState<AssetRow | null>(null);
  const [returnFor, setReturnFor] = useState<AssetRow | null>(null);
  const [editFor, setEditFor] = useState<AssetRow | null>(null);
  const [assignFor, setAssignFor] = useState<AssetRow | null>(null);

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ["assets"] });
    qc.invalidateQueries({ queryKey: ["asset-movements"] });
    qc.invalidateQueries({ queryKey: ["contract-assets"] });
  }

  return (
    <>
      <Topbar title="Inventario" />
      <div className="p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">Control del stock central de activos (celulares, radios, armas…) y su asignación a puestos.</p>
          </div>
          {canManage && (
            <Button className="gap-2" onClick={() => setIntakeOpen(true)}>
              <Plus className="h-4 w-4" /> Ingreso a stock
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-1 border-b">
          {[
            { key: "stock", label: "Stock disponible", icon: Package, badge: 0 },
            { key: "assigned", label: "Asignados", icon: MapPin, badge: 0 },
            { key: "pending", label: "Pendientes de devolución", icon: RotateCcw, badge: pendingCount },
            { key: "movements", label: "Movimientos", icon: History, badge: 0 },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as "stock" | "assigned" | "pending" | "movements")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
                tab === t.key
                  ? "border-[color:var(--app-primary)] text-[color:var(--app-primary)]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.badge > 0 && (
                <span className="ml-1 inline-flex min-w-[20px] justify-center items-center rounded-full bg-red-100 text-red-700 text-[11px] font-semibold px-1.5">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <label className="text-xs text-slate-500">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full h-9 text-sm border rounded-md px-2 bg-card"
            >
              <option value="">Todos los tipos</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {tab !== "movements" && (
            <div className="flex-1 min-w-[240px]">
              <label className="text-xs text-slate-500">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Código, nombre, marca, modelo…"
                  className="pl-8"
                />
              </div>
            </div>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {tab === "movements" ? (
              <MovementsTable movements={movements} loading={movementsLoading} />
            ) : (
              <AssetsTable
                assets={assets}
                loading={assetsLoading}
                tab={tab}
                canManage={canManage}
                onEdit={setEditFor}
                onAssign={(a) => setAssignFor(a)}
                onIssue={(a) => setIssueFor(a)}
                onReturn={(a) => setReturnFor(a)}
                onDelete={(a) => {
                  if (!confirm(`¿Eliminar el activo "${a.code}"? Esta acción es irreversible.`)) return;
                  fetch(`/api/assets/${a.id}`, { method: "DELETE" })
                    .then((r) => r.json())
                    .then((res) => {
                      if (res.error) {
                        toast.error(res.error.message ?? "Error");
                        return;
                      }
                      toast.success("Activo eliminado");
                      refreshAll();
                    });
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <IntakeDialog
        open={intakeOpen && canManage}
        onOpenChange={setIntakeOpen}
        types={activeTypes}
        onSuccess={refreshAll}
      />

      <IssueDialog
        asset={issueFor}
        onOpenChange={(v) => { if (!v) setIssueFor(null); }}
        onSuccess={refreshAll}
      />

      <ReturnDialog
        asset={returnFor}
        onOpenChange={(v) => { if (!v) setReturnFor(null); }}
        onSuccess={refreshAll}
      />

      <EditAssetDialog
        asset={editFor}
        onOpenChange={(v) => { if (!v) setEditFor(null); }}
        onSuccess={refreshAll}
      />

      <AssignFromStockDialog
        asset={assignFor}
        onOpenChange={(v) => { if (!v) setAssignFor(null); }}
        onSuccess={refreshAll}
      />
    </>
  );
}
