"use client";

import { useMemo } from "react";
import { LEGAL_DOCUMENT_TYPES, legalDocumentTypeMeta } from "@/modules/documentos-legales/business/catalog";
import type { LegalCalendarDay, LegalDocumentDto } from "@/modules/documentos-legales/business/dto";
import { formatCurrency } from "@/lib/utils/format";

function daysInGrid(month: string): { date: string; dayOfMonth: number; inMonth: boolean }[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const startDow = first.getDay();
  const totalDays = new Date(year, monthNumber, 0).getDate();
  const cells: { date: string; dayOfMonth: number; inMonth: boolean }[] = [];
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, monthNumber - 1, 1 - (startDow - i));
    cells.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      dayOfMonth: d.getDate(),
      inMonth: false,
    });
  }
  for (let day = 1; day <= totalDays; day++) {
    cells.push({
      date: `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      dayOfMonth: day,
      inMonth: true,
    });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const [y, m, d] = last.date.split("-").map(Number);
    const next = new Date(y, m - 1, d + 1);
    cells.push({
      date: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`,
      dayOfMonth: next.getDate(),
      inMonth: false,
    });
  }
  return cells;
}

export function LegalCalendarGrid({
  month,
  today,
  byDate,
  onOpenDay,
}: {
  month: string;
  today: string;
  byDate: Map<string, LegalCalendarDay>;
  onOpenDay: (date: string) => void;
}) {
  const cells = useMemo(() => daysInGrid(month), [month]);
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {LEGAL_DOCUMENT_TYPES.map((meta) => (
          <span key={meta.value} className={`rounded border px-2 py-0.5 text-xs ${meta.chip}`}>
            {meta.label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((label) => (
          <div key={label} className="py-1 text-center text-xs font-semibold text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0].date} className="grid grid-cols-7 gap-1">
          {week.map((cell) => {
            const day = byDate.get(cell.date);
            const documents = day?.documents ?? [];
            const isToday = cell.date === today;
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => cell.inMonth && onOpenDay(cell.date)}
                disabled={!cell.inMonth}
                className={[
                  "min-h-[108px] rounded-md border p-1.5 text-left flex flex-col gap-1",
                  cell.inMonth ? "bg-card hover:border-primary/40" : "bg-muted/30 opacity-60",
                  isToday ? "ring-2 ring-primary/60" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isToday ? "bg-primary text-primary-foreground" : "",
                  ].join(" ")}
                >
                  {cell.dayOfMonth}
                </span>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {documents.slice(0, 3).map((doc) => (
                    <DocChip key={doc.id} doc={doc} />
                  ))}
                  {documents.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{documents.length - 3}</span>
                  )}
                </div>
                {documents.length > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {formatCurrency(day?.total ?? 0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function DocChip({ doc }: { doc: LegalDocumentDto }) {
  const meta = legalDocumentTypeMeta(doc.type);
  return (
    <span
      className={`truncate rounded border px-1 text-[10px] leading-4 ${meta.chip} ${doc.paid ? "line-through opacity-70" : ""}`}
      title={`${doc.typeLabel}: ${doc.description}`}
    >
      {doc.description}
    </span>
  );
}
