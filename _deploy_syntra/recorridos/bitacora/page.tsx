"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { formatDateTime } from "@/lib/utils/format";

type BitacoraEntry = {
  id: string;
  imei: string;
  employeeCode: string;
  description: string;
  routeCode: string | null;
  incidentAt: string;
  imagePath: string | null;
  source: string;
  isLinked: boolean;
  linkedOmissionKey: string | null;
  justification: {
    id: string;
    routeCode: string;
    pointLabel: string;
    fecha: string;
  } | null;
};

type OmissionOption = {
  omissionKey: string;
  fecha: string;
  deviceId: string;
  routeId: string;
  routePointId: string;
  routeCode: string;
  routeName: string;
  pointLabel: string;
  nfcTagCode: string;
  imei: string;
  employeeCode: string;
};

function todayIsoCostaRica() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function incidentDateCr(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export default function RecorridosBitacoraPage() {
  const qc = useQueryClient();
  const [desde, setDesde] = useState(todayIsoCostaRica());
  const [hasta, setHasta] = useState(todayIsoCostaRica());
  const [imei, setImei] = useState("");
  const [unlinkedOnly, setUnlinkedOnly] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<BitacoraEntry | null>(null);
  const [selectedOmissionKey, setSelectedOmissionKey] = useState("");

  const queryKey = useMemo(
    () => ["patrol-bitacora", desde, hasta, imei.trim(), unlinkedOnly],
    [desde, hasta, imei, unlinkedOnly],
  );

  const { data, isLoading, refetch, isFetching } = useQuery<{ data: BitacoraEntry[] }>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ desde, hasta });
      if (imei.trim()) params.set("imei", imei.trim());
      if (unlinkedOnly) params.set("unlinkedOnly", "1");
      return fetch(`/api/admin/patrol/bitacora?${params}`).then((r) => r.json());
    },
    enabled: Boolean(desde && hasta),
  });

  const linkFecha = selectedEntry ? incidentDateCr(selectedEntry.incidentAt) : "";

  const { data: omissionsData } = useQuery<{ data: OmissionOption[] }>({
    queryKey: ["patrol-omissions-link", linkFecha, selectedEntry?.imei],
    queryFn: () => {
      const params = new URLSearchParams({ fecha: linkFecha });
      if (selectedEntry?.imei) params.set("imei", selectedEntry.imei);
      return fetch(`/api/admin/patrol/justifications/link?${params}`).then((r) => r.json());
    },
    enabled: linkOpen && Boolean(linkFecha),
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      const omission = omissionsData?.data?.find((o) => o.omissionKey === selectedOmissionKey);
      if (!selectedEntry || !omission) throw new Error("Seleccione una omisión");

      const res = await fetch("/api/admin/patrol/justifications/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bitacoraEntryId: selectedEntry.id,
          omissionKey: omission.omissionKey,
          fecha: omission.fecha,
          deviceId: omission.deviceId,
          routeId: omission.routeId,
          routePointId: omission.routePointId,
          routeCode: omission.routeCode,
          pointLabel: omission.pointLabel,
          nfcTagCode: omission.nfcTagCode,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "No se pudo ligar");
      }
    },
    onSuccess: () => {
      toast.success("Bitácora ligada a la omisión");
      setLinkOpen(false);
      setSelectedEntry(null);
      setSelectedOmissionKey("");
      qc.invalidateQueries({ queryKey: ["patrol-bitacora"] });
      qc.invalidateQueries({ queryKey: ["patrol-marks-compliance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const entries = data?.data ?? [];
  const omissionOptions = omissionsData?.data ?? [];

  function openLink(entry: BitacoraEntry) {
    setSelectedEntry(entry);
    setSelectedOmissionKey("");
    setLinkOpen(true);
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Bitácora digital
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Justificaciones enviadas desde la app SYNTRA. Líguelas a omisiones de marca en un clic.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entradas de bitácora</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground">Desde</label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hasta</label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">IMEI (opcional)</label>
              <Input value={imei} onChange={(e) => setImei(e.target.value)} placeholder="000000000000001" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={unlinkedOnly}
              onChange={(e) => setUnlinkedOnly(e.target.checked)}
            />
            Solo sin ligar a omisión
          </label>

          <Button onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Consultando…" : "Consultar"}
          </Button>

          <div className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay entradas en el periodo.</p>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="rounded-md border px-3 py-3 text-sm space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium">
                        {formatDateTime(entry.incidentAt)} · IMEI {entry.imei}
                      </p>
                      <p className="text-muted-foreground">
                        Empleado {entry.employeeCode}
                        {entry.routeCode ? ` · Ruta ${entry.routeCode}` : ""}
                      </p>
                      <p className="whitespace-pre-wrap">{entry.description}</p>
                      {entry.imagePath ? (
                        <a
                          href={entry.imagePath}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline inline-block mt-1"
                        >
                          Ver foto adjunta
                        </a>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {entry.isLinked ? (
                        <Badge variant="success">Ligada</Badge>
                      ) : (
                        <Badge variant="secondary">Sin ligar</Badge>
                      )}
                      {!entry.isLinked ? (
                        <Button size="sm" variant="outline" onClick={() => openLink(entry)}>
                          <Link2 className="h-3 w-3 mr-1" />
                          Ligar a omisión
                        </Button>
                      ) : entry.justification ? (
                        <p className="text-xs text-muted-foreground text-right">
                          {entry.justification.fecha} · {entry.justification.routeCode} /{" "}
                          {entry.justification.pointLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ligar bitácora a omisión</DialogTitle>
          </DialogHeader>
          {selectedEntry ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-3">{selectedEntry.description}</p>
              <div>
                <Label>Omisión del mismo día ({linkFecha})</Label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background"
                  value={selectedOmissionKey}
                  onChange={(e) => setSelectedOmissionKey(e.target.value)}
                >
                  <option value="">Seleccione omisión…</option>
                  {omissionOptions.map((o) => (
                    <option key={o.omissionKey} value={o.omissionKey}>
                      {o.routeCode} — {o.pointLabel} (tag {o.nfcTagCode})
                    </option>
                  ))}
                </select>
                {omissionOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    No hay omisiones pendientes de justificar para este IMEI en esa fecha.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => linkMutation.mutate()}
              disabled={!selectedOmissionKey || linkMutation.isPending}
            >
              Ligar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
