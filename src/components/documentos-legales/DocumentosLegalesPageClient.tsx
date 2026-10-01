"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { useCompanies } from "@/lib/hooks/use-companies";
import { companyDisplayName } from "@/lib/utils/constants";
import { formatCurrency, todayCalendarDateString } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "@/components/ui/toaster";
import type {
  LegalCalendarMonth,
  LegalChangeLogDto,
  LegalDocumentDto,
  ResponsibleUserDto,
} from "@/modules/documentos-legales/business/dto";
import { apiJson, monthQuery } from "./api";
import { LegalBitacora } from "./LegalBitacora";
import { LegalCalendarGrid } from "./LegalCalendarGrid";
import { LegalCronograma } from "./LegalCronograma";
import { LegalDayDialog } from "./LegalDayDialog";
import { LegalDocumentDialog } from "./LegalDocumentDialog";
import { LegalDocumentList } from "./LegalDocumentList";
import { LegalReporteMensual } from "./LegalReporteMensual";

type TabId = "calendario" | "cronograma" | "bitacora" | "reporte" | "listado";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(year, monthNumber - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function monthOptions(): [string, string][] {
  const start = new Date();
  start.setMonth(start.getMonth() - 12);
  const out: [string, string][] = [];
  for (let i = 0; i < 36; i++) {
    const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    out.push([value, date.toLocaleDateString("es-CR", { month: "long", year: "numeric" })]);
  }
  return out;
}

export function DocumentosLegalesPageClient() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session ?? null, "documentosLegales.calendario", "edit");
  const canAdmin = hasPermission(session ?? null, "documentosLegales.calendario", "admin");
  const queryClient = useQueryClient();
  const { data: companiesRes } = useCompanies();
  const companyRows = (companiesRes?.data ?? []).filter((row) => row.isActive);
  const [month, setMonth] = useState(currentMonth);
  const [companies, setCompanies] = useState<string[]>([]);
  const [tab, setTab] = useState<TabId>("calendario");
  const [day, setDay] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ doc: LegalDocumentDto | null; dueDate: string } | null>(null);
  const today = todayCalendarDateString();

  const calendar = useQuery({
    queryKey: ["documentos-legales", month, companies],
    queryFn: () =>
      apiJson<LegalCalendarMonth>(`/api/documentos-legales?${monthQuery(month, companies)}`),
  });
  const bitacora = useQuery({
    queryKey: ["documentos-legales-bitacora", month, companies],
    enabled: tab === "bitacora",
    queryFn: () =>
      apiJson<LegalChangeLogDto[]>(`/api/documentos-legales/bitacora?${monthQuery(month, companies)}`),
  });
  const responsibles = useQuery({
    queryKey: ["documentos-legales-responsables"],
    enabled: canEdit,
    queryFn: () => apiJson<ResponsibleUserDto[]>("/api/documentos-legales/responsables"),
  });

  const markPaid = useMutation({
    mutationFn: (doc: LegalDocumentDto) =>
      apiJson<LegalDocumentDto>(`/api/documentos-legales/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: !doc.paid }),
      }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      void queryClient.invalidateQueries({ queryKey: ["documentos-legales"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const documents = calendar.data?.documents ?? [];
  const byDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof calendar.data>["days"][number]>();
    for (const entry of calendar.data?.days ?? []) map.set(entry.date, entry);
    return map;
  }, [calendar.data]);
  const dayDocuments = day ? (byDate.get(day)?.documents ?? []) : [];
  const companyOptions = companyRows.map((row) => ({
    value: row.code,
    label: companyDisplayName(row.code, companyRows),
    searchText: `${row.code} ${row.name}`,
  }));
  const totals = calendar.data?.totals;

  function openCreate(dueDate: string) {
    setDay(null);
    setEditor({ doc: null, dueDate });
  }

  function openEdit(doc: LegalDocumentDto) {
    setDay(null);
    setEditor({ doc, dueDate: doc.dueDate });
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Control de Documentos Legales</h1>
        {canEdit && (
          <Button type="button" onClick={() => openCreate(today)}>
            <Plus className="mr-1 h-4 w-4" /> Agregar
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" aria-label="Mes anterior" onClick={() => setMonth((value) => shiftMonth(value, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm font-medium"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            {monthOptions().map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="icon" aria-label="Mes siguiente" onClick={() => setMonth((value) => shiftMonth(value, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <MultiSelect
          options={companyOptions}
          value={companies}
          onChange={setCompanies}
          placeholder="Todas las empresas"
          searchable
          searchPlaceholder="Buscar empresa…"
          className="w-[280px] max-w-[360px]"
        />
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Pendiente: <span className="font-semibold text-amber-600">{formatCurrency(totals?.pending ?? 0)}</span>
          </span>
          <span className="text-muted-foreground">
            Pagado: <span className="font-semibold text-emerald-600">{formatCurrency(totals?.paid ?? 0)}</span>
          </span>
          <span className="text-muted-foreground">
            Total: <span className="font-semibold">{formatCurrency(totals?.total ?? 0)}</span>
          </span>
          {calendar.isFetching && <span className="text-xs text-muted-foreground">cargando…</span>}
        </div>
      </div>

      {calendar.isError && (
        <p className="text-sm text-destructive">{(calendar.error as Error).message}</p>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
        <TabsList>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="reporte">Reporte</TabsTrigger>
          <TabsTrigger value="listado">Listado</TabsTrigger>
          <TabsTrigger value="bitacora">Bitácora</TabsTrigger>
        </TabsList>
        <TabsContent value="calendario" className="mt-3">
          <LegalCalendarGrid month={month} today={today} byDate={byDate} onOpenDay={setDay} />
        </TabsContent>
        <TabsContent value="cronograma" className="mt-3">
          <LegalCronograma month={month} today={today} documents={documents} onOpen={openEdit} />
        </TabsContent>
        <TabsContent value="reporte" className="mt-3">
          <LegalReporteMensual documents={documents} />
        </TabsContent>
        <TabsContent value="listado" className="mt-3">
          <LegalDocumentList month={month} documents={documents} companies={companyRows} onOpen={openEdit} />
        </TabsContent>
        <TabsContent value="bitacora" className="mt-3">
          <LegalBitacora rows={bitacora.data ?? []} />
        </TabsContent>
      </Tabs>

      <LegalDayDialog
        date={day}
        documents={dayDocuments}
        canEdit={canEdit}
        onClose={() => setDay(null)}
        onCreate={openCreate}
        onEdit={openEdit}
        onTogglePaid={(doc) => markPaid.mutate(doc)}
      />
      {editor && (
        <LegalDocumentDialog
          key={editor.doc?.id ?? `new-${editor.dueDate}`}
          open
          document={editor.doc}
          dueDate={editor.dueDate}
          companies={companyRows}
          responsibles={responsibles.data ?? []}
          canEdit={canEdit}
          canAdmin={canAdmin}
          onClose={() => setEditor(null)}
          onDeleted={() => setEditor(null)}
          onSaved={(saved) => setEditor({ doc: saved, dueDate: saved.dueDate })}
        />
      )}
    </div>
  );
}
