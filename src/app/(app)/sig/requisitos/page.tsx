"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportRowsToExcel, exportWorkbookToExcel } from "@/lib/utils/excel-export";

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

function clip(text: string | null | undefined, max = 160) {
  const t = text?.trim();
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function shortNorma(code: string) {
  return code.replace(/^ISO_/, "");
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
      observations: pickLongestText(sorted, "observations"),
    };
  });
}

function toExportRows(list: RequirementRow[]) {
  return list.map((r) => ({
    Norma: r.standard.code,
    Código: r.code,
    Título: r.title,
    "Requisito esperado": r.description ?? "",
    Observaciones: r.observations ?? "",
    Aplicable: r.isApplicable ? "Sí" : "No",
    Estado: LIGHT[r.trafficLight].label,
    Procesos: r._count.processLinks,
    Docs: r._count.documentLinks,
    Evidencias: r._count.evidenceLinks,
    NC: r.openNcCount,
    "Últ. revisión": r.lastRevisionAt ? formatDate(r.lastRevisionAt) : "",
  }));
}

const COL_WIDTHS = [12, 10, 36, 48, 40, 10, 14, 10, 8, 10, 8, 14];

const TH =
  "sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-3 py-2 font-semibold shadow-[0_1px_0_0_rgb(226_232_240)]";

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
      return (Array.isArray(json.data) ? json.data : []) as Standard[];
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
      return (Array.isArray(json.data) ? json.data : []) as RequirementRow[];
    },
  });

  /** Todas las normas (sin filtro de norma) para poder descargar ambas aunque el filtro esté activo. */
  const { data: allRows = [] } = useQuery({
    queryKey: ["sig-requirements-export-all", q, applicableOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (applicableOnly) params.set("applicable", "1");
      const r = await fetch(`/api/sig/requirements?${params}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error cargando requisitos");
      const json = await r.json();
      return (Array.isArray(json.data) ? json.data : []) as RequirementRow[];
    },
  });

  const integrated = useMemo(() => integrateByClause(rows), [rows]);
  const showIntegrated = !standardId;

  const downloadableStandards = useMemo(() => {
    const ids = new Set(allRows.map((r) => r.standard.id));
    return standards.filter((s) => ids.has(s.id) || !allRows.length);
  }, [standards, allRows]);

  function downloadStandard(std: Standard) {
    const list = allRows.filter((r) => r.standard.id === std.id);
    if (!list.length) return;
    exportRowsToExcel({
      filename: `matriz-requisitos-${shortNorma(std.code)}`,
      sheetName: shortNorma(std.code),
      rows: toExportRows(list),
      columnWidths: COL_WIDTHS,
    });
  }

  function downloadBoth() {
    const byStd = new Map<string, RequirementRow[]>();
    for (const row of allRows) {
      const key = row.standard.id;
      const list = byStd.get(key);
      if (list) list.push(row);
      else byStd.set(key, [row]);
    }
    const sheets = Array.from(byStd.entries()).map(([id, list]) => {
      const std = list[0]?.standard;
      return {
        sheetName: shortNorma(std?.code ?? id),
        rows: toExportRows(list),
        columnWidths: COL_WIDTHS,
      };
    });
    if (!sheets.length) return;
    exportWorkbookToExcel({
      filename: "matriz-requisitos-SIG-normas",
      sheets,
    });
  }

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

        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <span className="mr-1 text-sm font-medium text-slate-700">Descargar normas</span>
            {downloadableStandards.map((s) => (
              <Button
                key={s.id}
                type="button"
                size="sm"
                variant="outline"
                disabled={!allRows.some((r) => r.standard.id === s.id)}
                onClick={() => downloadStandard(s)}
                title={s.name}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {shortNorma(s.code)}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              disabled={allRows.length === 0}
              onClick={() => downloadBoth()}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Ambas (Excel)
            </Button>
            <p className="w-full text-xs text-slate-500">
              Exporta la matriz de requisitos de cada norma (catálogo del SIG). No sustituye el texto
              oficial ISO.
            </p>
          </CardContent>
        </Card>

        {showIntegrated && !isLoading && (
          <p className="text-sm text-slate-600">
            Vista integrada Anexo SL: en cada cláusula se muestra el requisito de cada norma. Filtre por
            norma si necesita verlas por separado.
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {(error as Error).message}
          </div>
        )}

        <Card>
          <CardContent className="max-h-[calc(100vh-16rem)] overflow-auto p-0">
            <table className="w-full min-w-[1280px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className={TH}>Estado</th>
                  <th className={TH}>Normas</th>
                  <th className={TH}>Código</th>
                  <th className={`${TH} min-w-[280px]`}>Requisito por norma</th>
                  <th className={`${TH} min-w-[200px]`}>Observaciones</th>
                  <th className={TH}>Procesos</th>
                  <th className={TH}>Docs</th>
                  <th className={TH}>Evidencias</th>
                  <th className={TH}>NC</th>
                  <th className={`${TH} whitespace-nowrap`}>Últ. revisión</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
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
                      <tr key={group.code} className="align-top hover:bg-slate-50">
                        <td className="border-t px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${light.className}`}>
                            {light.label}
                          </span>
                          {group.items.length > 1 && (
                            <div className="mt-1 space-y-0.5">
                              {group.items.map((item) => (
                                <div key={item.id} className="text-[11px] text-slate-500">
                                  {shortNorma(item.standard.code)}: {LIGHT[item.trafficLight].label}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="border-t px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {group.items.map((item) => (
                              <Link
                                key={item.id}
                                href={`/sig/requisitos/${item.id}`}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-800"
                                title={item.standard.name}
                              >
                                {shortNorma(item.standard.code)}
                              </Link>
                            ))}
                          </div>
                        </td>
                        <td className="border-t px-3 py-2 font-medium">
                          <span className="text-red-700">{group.code}</span>
                        </td>
                        <td className="border-t px-3 py-2">
                          <div className="space-y-2">
                            {group.items.map((item) => (
                              <Link
                                key={item.id}
                                href={`/sig/requisitos/${item.id}`}
                                className="block rounded-md border border-slate-200 bg-white px-2.5 py-2 hover:border-red-200 hover:bg-red-50/40"
                              >
                                <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                    {shortNorma(item.standard.code)}
                                  </span>
                                  <span className="text-sm font-medium text-slate-900">{item.title}</span>
                                </div>
                                <p
                                  className="text-xs leading-relaxed text-slate-600"
                                  title={item.description ?? undefined}
                                >
                                  {clip(item.description, 220)}
                                </p>
                              </Link>
                            ))}
                          </div>
                        </td>
                        <td className="border-t px-3 py-2 text-slate-600" title={group.observations ?? undefined}>
                          {clip(group.observations, 140)}
                        </td>
                        <td className="border-t px-3 py-2">{group.processLinks}</td>
                        <td className="border-t px-3 py-2">
                          <Link
                            href={`/sig/requisitos/${primary.id}#documentos`}
                            className="text-red-700 hover:underline"
                          >
                            {group.documentLinks}
                          </Link>
                        </td>
                        <td className="border-t px-3 py-2">
                          <Link
                            href={`/sig/requisitos/${primary.id}#evidencias`}
                            className="text-red-700 hover:underline"
                          >
                            {group.evidenceLinks}
                          </Link>
                        </td>
                        <td className="border-t px-3 py-2">
                          {group.openNcCount > 0 ? (
                            <Badge variant="danger">{group.openNcCount}</Badge>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="border-t px-3 py-2 whitespace-nowrap text-slate-600">
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
                      <tr key={row.id} className="align-top hover:bg-slate-50">
                        <td className="border-t px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${light.className}`}>
                            {light.label}
                          </span>
                        </td>
                        <td className="border-t px-3 py-2">{row.standard.code}</td>
                        <td className="border-t px-3 py-2 font-medium">
                          <Link href={`/sig/requisitos/${row.id}`} className="text-red-700 hover:underline">
                            {row.code}
                          </Link>
                        </td>
                        <td className="border-t px-3 py-2">
                          <Link
                            href={`/sig/requisitos/${row.id}`}
                            className="block rounded-md border border-slate-200 bg-white px-2.5 py-2 hover:border-red-200 hover:bg-red-50/40"
                          >
                            <div className="mb-0.5 text-sm font-medium text-slate-900">{row.title}</div>
                            <p className="text-xs leading-relaxed text-slate-600" title={row.description ?? undefined}>
                              {clip(row.description, 220)}
                            </p>
                          </Link>
                        </td>
                        <td className="border-t px-3 py-2 text-slate-600" title={row.observations ?? undefined}>
                          {clip(row.observations, 140)}
                        </td>
                        <td className="border-t px-3 py-2">{row._count.processLinks}</td>
                        <td className="border-t px-3 py-2">
                          <Link
                            href={`/sig/requisitos/${row.id}#documentos`}
                            className="text-red-700 hover:underline"
                          >
                            {row._count.documentLinks}
                          </Link>
                        </td>
                        <td className="border-t px-3 py-2">
                          <Link
                            href={`/sig/requisitos/${row.id}#evidencias`}
                            className="text-red-700 hover:underline"
                          >
                            {row._count.evidenceLinks}
                          </Link>
                        </td>
                        <td className="border-t px-3 py-2">
                          {row.openNcCount > 0 ? (
                            <Badge variant="danger">{row.openNcCount}</Badge>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="border-t px-3 py-2 whitespace-nowrap text-slate-600">
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
