"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Standard = {
  id: string;
  code: string;
  name: string;
  year: number | null;
  hasPdf?: boolean;
  pdfFileName?: string | null;
};
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

const TH =
  "sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-3 py-2 font-semibold shadow-[0_1px_0_0_rgb(226_232_240)]";

export default function SigRequisitosPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [standardId, setStandardId] = useState("");
  const [applicableOnly, setApplicableOnly] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const integrated = useMemo(() => integrateByClause(rows), [rows]);
  const showIntegrated = !standardId;

  const normaStandards = useMemo(
    () => standards.filter((s) => s.code === "ISO_9001" || s.code === "ISO_18788"),
    [standards]
  );

  function openPdf(std: Standard, download = false) {
    setPdfError(null);
    if (!std.hasPdf) {
      setPdfError(`Primero suba el PDF oficial de ${shortNorma(std.code)} (copia licenciada).`);
      return;
    }
    const url = `/api/sig/standards/${std.id}/pdf${download ? "?inline=0" : "?inline=1"}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openBothPdfs() {
    setPdfError(null);
    const withPdf = normaStandards.filter((s) => s.hasPdf);
    if (!withPdf.length) {
      setPdfError("Aún no hay PDFs de norma. Suba ISO 9001 e ISO 18788 con «Subir PDF».");
      return;
    }
    for (const std of withPdf) {
      window.open(`/api/sig/standards/${std.id}/pdf?inline=1`, "_blank", "noopener,noreferrer");
    }
    const missing = normaStandards.filter((s) => !s.hasPdf);
    if (missing.length) {
      setPdfError(
        `Abiertas: ${withPdf.map((s) => shortNorma(s.code)).join(", ")}. Falta PDF: ${missing
          .map((s) => shortNorma(s.code))
          .join(", ")}.`
      );
    }
  }

  async function onUploadPdf(std: Standard, file: File | null) {
    if (!file) return;
    setUploadingId(std.id);
    setPdfError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const r = await fetch(`/api/sig/standards/${std.id}/pdf`, { method: "POST", body });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo subir el PDF");
      await qc.invalidateQueries({ queryKey: ["sig-standards"] });
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Error subiendo PDF");
    } finally {
      setUploadingId(null);
      const input = uploadRefs.current[std.id];
      if (input) input.value = "";
    }
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
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium text-slate-700">PDF de las normas</span>
              {normaStandards.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={s.hasPdf ? "default" : "outline"}
                    disabled={!s.hasPdf}
                    onClick={() => openPdf(s)}
                    title={s.hasPdf ? s.pdfFileName ?? s.name : "Suba el PDF oficial primero"}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {shortNorma(s.code)}
                    {s.hasPdf ? "" : " (sin PDF)"}
                  </Button>
                  <input
                    ref={(el) => {
                      uploadRefs.current[s.id] = el;
                    }}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => void onUploadPdf(s, e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploadingId === s.id}
                    onClick={() => uploadRefs.current[s.id]?.click()}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {uploadingId === s.id ? "Subiendo…" : s.hasPdf ? "Reemplazar PDF" : "Subir PDF"}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!normaStandards.some((s) => s.hasPdf)}
                onClick={() => openBothPdfs()}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Abrir ambas
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Abre el PDF oficial de cada norma (copia licenciada de la organización). La primera vez
              use «Subir PDF» con el archivo ISO que compraron; después «9001» / «18788» lo abren en
              el navegador.
            </p>
            {pdfError && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {pdfError}
              </div>
            )}
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
