"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import type { NotificationPreferenceItem } from "@/modules/notifications/business/types";
import { MODULE_LABELS } from "@/modules/notifications/business/types";

export default function NotificationPreferencesPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{
    data: { preferences: NotificationPreferenceItem[] };
  }>({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const r = await fetch("/api/notifications/preferences");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const save = useMutation({
    mutationFn: async (preferences: { typeId: string; enabled: boolean }[]) => {
      const r = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
    },
    onSuccess: () => {
      toast.success("Preferencias guardadas");
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const prefs = data?.data?.preferences ?? [];

  const toggle = (typeId: string, enabled: boolean) => {
    const next = prefs.map((p) =>
      p.typeId === typeId ? { typeId, enabled } : { typeId: p.typeId, enabled: p.enabled },
    );
    save.mutate(next);
  };

  const grouped = prefs.reduce<Record<string, NotificationPreferenceItem[]>>((acc, p) => {
    const key = MODULE_LABELS[p.moduleKey] ?? p.moduleKey;
    acc[key] = acc[key] ?? [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <>
      <Topbar title="Preferencias de notificaciones" />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Settings className="h-7 w-7 text-red-600" />
              Preferencias
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure qué tipos de notificación desea recibir. Siempre se respetan los
              permisos de su rol.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/notificaciones/historial">Ver historial</Link>
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Cargando…</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([moduleLabel, items]) => (
              <section key={moduleLabel} className="rounded-xl border border-border bg-card">
                <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">
                  {moduleLabel}
                </h2>
                <ul>
                  {items.map((p) => (
                    <li
                      key={p.typeId}
                      className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{p.label}</p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        )}
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          disabled={!p.canDisable || save.isPending}
                          onChange={(e) => toggle(p.typeId, e.target.checked)}
                          className="h-4 w-4 rounded border-input"
                        />
                        Recibir
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
