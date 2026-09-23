"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Standard = { id: string; code: string; name: string; year: number | null };
type RequirementRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  observations: string | null;
  isApplicable: boolean;
  trafficLight: "RED" | "YELLOW" | "GREEN" | "GRAY";
  openNcCount: number;
  lastRevisionAt: string | null;
  standard: Standard;
  _count: { processLinks: number; documentLinks: number; evidenceLinks: number; findingLinks: number };
};

type IntegratedClause = {
  code: string;
  title: string;
  items: RequirementRow[];
  trafficLight: RequirementRow["trafficLight"];
  processLinks: number;
  documentLinks: number;
  evidenceLinks: number;
  openNcCount: number;
  lastRevisionAt: string | null;
  description: string | null;
  observations: string | null;
};

const LIGHT: Record<RequirementRow["trafficLight"], { label: string; className: string }> = {
  GREEN: { label: "Con evidencias", className: "bg-emerald-100 text-emerald-800" },
  YELLOW: { label: "Sin evidencias", className: "bg-amber-100 text-amber-800" },
  RED: { label: "NC abiertas", className: "bg-red-100 text-red-800" },
  GRAY: { label: "No aplicable", className: "bg-slate-100 text-slate-600" },
};

const LIGHT_RANK: Record<RequirementRow["trafficLight"], number> = {
  RED: 0,
  YELLOW: 1,
  GREEN: 2,
  GRAY: 3,
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "2-digit" });
}

function clip(text: string | null | undefined, max = 120) {
  const t = text?.trim();
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function pickLongestText(items: RequirementRow[], field: "description" | "observations") {
  let best: string | null = null;
  for (const item of items) {
    const t = item[field]?.trim();
    if (!t) continue;
    if (!best || t.length > best.length) best = t;
  }
  return best;
}

function maxIso(dates: Array<string | null>) {
  let best: number | null = null;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    if (best == null || t > best) best = t;
  }
  return best == null ? null : new Date(best).toISOString();
}

/** Agrupa por código de cláusula (Anexo SL): ISO 9001 + 18788 en la misma fila. */
function integrateByClause(rows: RequirementRow[]): IntegratedClause[] {
  const map = new Map<string, RequirementRow[]>();
  for (const row of rows) {
    const key = row.code.trim();
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }

  return Array.from(map.entries()).map(([code, items]) => {
    const sorted = [...items].sort((a, b) => a.standard.code.localeCompare(b.standard.code, "es"));
    const trafficLight = sorted.reduce<RequirementRow["trafficLight"]>((worst, item) => {
      return LIGHT_RANK[item.trafficLight] < LIGHT_RANK[worst] ? item.trafficLight : worst;
    }, sorted[0]?.trafficLight ?? "GRAY");

    return {
      code,
      title: sorted[0]?.title ?? code,
      items: sorted,
      trafficLight,
      processLinks: sorted.reduce((n, i) => n + i._count.processLinks, 0),
      documentLinks: sorted.reduce((n, i) => n + i._count.documentLinks, 0),
      evidenceLinks: sorted.reduce((n, i) => n + i._count.evidenceLinks, 0),
      openNcCount: sorted.reduce((n, i) => n + i.openNcCount, 0),
      lastRevisionAt: maxIso(sorted.map((i) => i.lastRevisionAt)),
      description: pickLongestText(sorted, "description"),
      observations: pickLongestText(sorted, "observations"),
    };
  });
}

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

  const integrated = useMemo(() => integrateByClause(rows), [rows]);
  const showIntegrated = !standardId;

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title="Matriz de requisitos SIG" />
      <div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-4">
            <div className="space-y-1 md:col-span-2">
              <Label>Buscar</Label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Código, título u observación (ej. 7.2)"
              />
            </div>
            <div className="space-y-1">
              <Label>Norma</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={standardId}
                onChange={(e) => setStandardId(e.target.value)}
              >
                <option value="">Todas (integradas)</option>
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

        {showIntegrated && !isLoading && (
          <p className="text-sm text-slate-600">
            Vista integrada Anexo SL: misma cláusula (ej. 4.1) junta ISO 9001 e ISO 18788. Filtre por norma
            si necesita verlas por separado.
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {(error as Error).message}
          </div>
        )}

        <Card>
          <CardContent className="overflow-auto p-0">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Normas</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Requisito</th>
                  <th className="px-3 py-2 min-w-[220px]">Requisito esperado</th>
                  <th className="px-3 py-2 min-w-[200px]">Observaciones</th>
                  <th className="px-3 py-2">Procesos</th>
                  <th className="px-3 py-2">Docs</th>
                  <th className="px-3 py-2">Evidencias</th>
                  <th className="px-3 py-2">NC</th>
                  <th className="px-3 py-2 whitespace-nowrap">Últ. revisión</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                      Cargando matriz...
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  showIntegrated &&
                  integrated.map((group) => {
                    const light = LIGHT[group.trafficLight];
                    const primary = group.items[0];
                    return (
                      <tr key={group.code} className="border-t hover:bg-slate-50 align-top">
                        <td className="px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${light.className}`}>
                            {light.label}
                          </span>
                          {group.items.length > 1 && (
                            <div className="mt-1 space-y-0.5">
                              {group.items.map((item) => (
                                <div key={item.id} className="text-[11px] text-slate-500">
                                  {item.standard.code.replace(/^ISO_/, "")}: {LIGHT[item.trafficLight].label}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {group.items.map((item) => (
                              <Link
                                key={item.id}
                                href={`/sig/requisitos/${item.id}`}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-800"
                                title={item.standard.name}
                              >
                                {item.standard.code.replace(/^ISO_/, "")}
                              </Link>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-medium">
                          <Link
                            href={`/sig/requisitos/${primary.id}`}
                            className="text-red-700 hover:underline"
                          >
                            {group.code}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{group.title}</div>
                          {group.items.length > 1 && (
                            <div className="mt-1 flex flex-col gap-0.5 text-xs">
                              {group.items.map((item) => (
                                <Link
                                  key={item.id}
                                  href={`/sig/requisitos/${item.id}`}
                                  className="text-red-700 hover:underline"
                                >
                                  Abrir {item.standard.code.replace(/^ISO_/, "")}
                                </Link>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600" title={group.description ?? undefined}>
                          {clip(group.description, 140)}
                        </td>
                        <td className="px-3 py-2 text-slate-600" title={group.observations ?? undefined}>
                          {clip(group.observations, 120)}
                        </td>
                        <td className="px-3 py-2">{group.processLinks}</td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/sig/requisitos/${primary.id}#documentos`}
                            className="text-red-700 hover:underline"
                          >
                            {group.documentLinks}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/sig/requisitos/${primary.id}#evidencias`}
                            className="text-red-700 hover:underline"
                          >
                            {group.evidenceLinks}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {group.openNcCount > 0 ? (
                            <Badge variant="danger">{group.openNcCount}</Badge>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                          {formatDate(group.lastRevisionAt)}
                        </td>
                      </tr>
                    );
                  })}
                {!isLoading &&
                  !showIntegrated &&
                  rows.map((row) => {
                    const light = LIGHT[row.trafficLight];
                    return (
                      <tr key={row.id} className="border-t hover:bg-slate-50 align-top">
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
                        <td className="px-3 py-2">
                          <Link href={`/sig/requisitos/${row.id}`} className="hover:underline">
                            {row.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-slate-600" title={row.description ?? undefined}>
                          {clip(row.description, 140)}
                        </td>
                        <td className="px-3 py-2 text-slate-600" title={row.observations ?? undefined}>
                          {clip(row.observations, 120)}
                        </td>
                        <td className="px-3 py-2">{row._count.processLinks}</td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/sig/requisitos/${row.id}#documentos`}
                            className="text-red-700 hover:underline"
                          >
                            {row._count.documentLinks}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/sig/requisitos/${row.id}#evidencias`}
                            className="text-red-700 hover:underline"
                          >
                            {row._count.evidenceLinks}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {row.openNcCount > 0 ? (
                            <Badge variant="danger">{row.openNcCount}</Badge>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                          {formatDate(row.lastRevisionAt)}
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
