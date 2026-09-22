"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type VersionOpt = { id: string; versionLabel: string };

type CompareResult = {
  a: { versionLabel: string | null; changeSummary: string | null };
  b: { versionLabel: string | null; changeSummary: string | null };
  sectionDiffs: {
    key: string;
    title: string;
    number: string | null;
    changed: boolean;
    onlyInA: boolean;
    onlyInB: boolean;
    bodyA: string;
    bodyB: string;
  }[];
  activityDiffs: {
    index: number;
    changed: boolean;
    onlyInA: boolean;
    onlyInB: boolean;
    a: { name: string; description: string; documents: string | null; responsible: string | null } | null;
    b: { name: string; description: string; documents: string | null; responsible: string | null } | null;
  }[];
};

type Props = {
  documentId: string;
  versions: VersionOpt[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialA?: string;
  initialB?: string;
};

export function DocumentVersionCompare({
  documentId,
  versions,
  open,
  onOpenChange,
  initialA,
  initialB,
}: Props) {
  const sorted = useMemo(
    () => [...versions].sort((x, y) => y.versionLabel.localeCompare(x.versionLabel, undefined, { numeric: true })),
    [versions]
  );
  const [a, setA] = useState(initialA ?? sorted[1]?.id ?? sorted[0]?.id ?? "");
  const [b, setB] = useState(initialB ?? sorted[0]?.id ?? "");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["sig-procedure-compare", documentId, a, b],
    enabled: open && Boolean(a && b && a !== b),
    queryFn: async () => {
      const r = await fetch(
        `/api/sig/documents/${documentId}/procedure/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`,
        { credentials: "same-origin" }
      );
      if (!r.ok) {
        const json = await r.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Error al comparar");
      }
      return r.json() as Promise<{ data: CompareResult }>;
    },
  });

  const cmp = data?.data;
  const changedSections = cmp?.sectionDiffs.filter((s) => s.changed) ?? [];
  const changedActs = cmp?.activityDiffs.filter((s) => s.changed) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparar versiones</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Versión A</label>
            <select
              className="block h-9 rounded-md border px-2 text-sm min-w-[8rem]"
              value={a}
              onChange={(e) => setA(e.target.value)}
            >
              {sorted.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionLabel}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Versión B</label>
            <select
              className="block h-9 rounded-md border px-2 text-sm min-w-[8rem]"
              value={b}
              onChange={(e) => setB(e.target.value)}
            >
              {sorted.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionLabel}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" variant="secondary" onClick={() => refetch()} disabled={isFetching}>
            Actualizar
          </Button>
        </div>

        {a === b && (
          <p className="text-sm text-amber-800">Seleccione dos versiones distintas.</p>
        )}
        {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
        {isLoading && <p className="text-sm text-muted-foreground">Comparando…</p>}

        {cmp && (
          <div className="space-y-4 mt-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">
                A: v{cmp.a.versionLabel}
                {cmp.a.changeSummary ? ` — ${cmp.a.changeSummary.slice(0, 80)}` : ""}
              </Badge>
              <Badge variant="outline">
                B: v{cmp.b.versionLabel}
                {cmp.b.changeSummary ? ` — ${cmp.b.changeSummary.slice(0, 80)}` : ""}
              </Badge>
              <Badge variant="secondary">{changedSections.length} secciones distintas</Badge>
              <Badge variant="secondary">{changedActs.length} actividades distintas</Badge>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Secciones</h4>
              {changedSections.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin diferencias en secciones.</p>
              ) : (
                <div className="space-y-3">
                  {changedSections.map((s) => (
                    <div key={s.key} className="border rounded-md overflow-hidden">
                      <div className="bg-muted/40 px-3 py-1.5 text-sm font-medium flex gap-2 items-center">
                        {s.number ? `${s.number}. ` : ""}
                        {s.title}
                        {s.onlyInA && <Badge variant="outline">Solo en A</Badge>}
                        {s.onlyInB && <Badge variant="outline">Solo en B</Badge>}
                      </div>
                      <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x">
                        <pre className="p-3 text-xs whitespace-pre-wrap max-h-48 overflow-auto">
                          {s.bodyA || "—"}
                        </pre>
                        <pre className="p-3 text-xs whitespace-pre-wrap max-h-48 overflow-auto bg-amber-50/40">
                          {s.bodyB || "—"}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Actividades</h4>
              {changedActs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin diferencias en actividades.</p>
              ) : (
                <div className="space-y-3">
                  {changedActs.map((act) => (
                    <div key={act.index} className="border rounded-md overflow-hidden">
                      <div className="bg-muted/40 px-3 py-1.5 text-sm font-medium">
                        Fila {act.index}
                      </div>
                      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x text-xs">
                        <div className="p-3 space-y-1">
                          <p className="font-medium">{act.a?.name ?? "—"}</p>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {act.a?.description ?? "—"}
                          </p>
                          <p>Docs: {act.a?.documents || "—"}</p>
                          <p>Resp: {act.a?.responsible || "—"}</p>
                        </div>
                        <div className="p-3 space-y-1 bg-amber-50/40">
                          <p className="font-medium">{act.b?.name ?? "—"}</p>
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {act.b?.description ?? "—"}
                          </p>
                          <p>Docs: {act.b?.documents || "—"}</p>
                          <p>Resp: {act.b?.responsible || "—"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
