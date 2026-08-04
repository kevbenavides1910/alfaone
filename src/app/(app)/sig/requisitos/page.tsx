"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Standard = { id: string; code: string; name: string; year: number | null };
type RequirementRow = {
  id: string;
  code: string;
  title: string;
  isApplicable: boolean;
  trafficLight: "RED" | "YELLOW" | "GREEN" | "GRAY";
  openNcCount: number;
  standard: Standard;
  _count: { processLinks: number; documentLinks: number; evidenceLinks: number; findingLinks: number };
};

const LIGHT: Record<RequirementRow["trafficLight"], { label: string; className: string }> = {
  GREEN: { label: "Con evidencias", className: "bg-emerald-100 text-emerald-800" },
  YELLOW: { label: "Sin evidencias", className: "bg-amber-100 text-amber-800" },
  RED: { label: "NC abiertas", className: "bg-red-100 text-red-800" },
  GRAY: { label: "No aplicable", className: "bg-slate-100 text-slate-600" },
};

export default function SigRequisitosPage() {
  const [q, setQ] = useState("");
  const [standardId, setStandardId] = useState("");
  const [applicableOnly, setApplicableOnly] = useState(true);

  const { data: standards = [] } = useQuery({
    queryKey: ["sig-standards"],
    queryFn: async () => {
      const r = await fetch("/api/sig/requirements?standards=1", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error cargando normas");
      const json = await r.json();
      return json.data as Standard[];
    },
  });

  const queryKey = useMemo(
    () => ["sig-requirements", q, standardId, applicableOnly] as const,
    [q, standardId, applicableOnly]
  );

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (standardId) params.set("standardId", standardId);
      if (applicableOnly) params.set("applicable", "1");
      const r = await fetch(`/api/sig/requirements?${params}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error cargando requisitos");
      const json = await r.json();
      return json.data as RequirementRow[];
    },
  });

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title="Matriz de requisitos SIG" />
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-4">
            <div className="space-y-1 md:col-span-2">
              <Label>Buscar</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código o título (ej. 7.2)" />
            </div>
            <div className="space-y-1">
              <Label>Norma</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={standardId}
                onChange={(e) => setStandardId(e.target.value)}
              >
                <option value="">Todas</option>
                {standards.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={applicableOnly}
                  onChange={(e) => setApplicableOnly(e.target.checked)}
                />
                Solo aplicables
              </label>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {(error as Error).message}
          </div>
        )}

        <Card>
          <CardContent className="overflow-auto p-0">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Norma</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Requisito</th>
                  <th className="px-3 py-2">Procesos</th>
                  <th className="px-3 py-2">Docs</th>
                  <th className="px-3 py-2">Evidencias</th>
                  <th className="px-3 py-2">NC</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                      Cargando matriz...
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  rows.map((row) => {
                    const light = LIGHT[row.trafficLight];
                    return (
                      <tr key={row.id} className="border-t hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${light.className}`}>
                            {light.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">{row.standard.code}</td>
                        <td className="px-3 py-2 font-medium">
                          <Link href={`/sig/requisitos/${row.id}`} className="text-red-700 hover:underline">
                            {row.code}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{row.title}</td>
                        <td className="px-3 py-2">{row._count.processLinks}</td>
                        <td className="px-3 py-2">{row._count.documentLinks}</td>
                        <td className="px-3 py-2">{row._count.evidenceLinks}</td>
                        <td className="px-3 py-2">
                          {row.openNcCount > 0 ? (
                            <Badge variant="danger">{row.openNcCount}</Badge>
                          ) : (
                            "0"
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
