"use client";

import { useMemo } from "react";
import { legalDocumentTypeMeta } from "@/modules/documentos-legales/business/catalog";
import type { LegalDocumentDto } from "@/modules/documentos-legales/business/dto";
import { formatCurrency } from "@/lib/utils/format";

export function LegalCronograma({
  month,
  today,
  documents,
  onOpen,
}: {
  month: string;
  today: string;
  documents: LegalDocumentDto[];
  onOpen: (doc: LegalDocumentDto) => void;
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const totalDays = new Date(year, monthNumber, 0).getDate();
  const days = useMemo(() => Array.from({ length: totalDays }, (_, index) => index + 1), [totalDays]);
  const todayNum = today.startsWith(month) ? Number(today.slice(8, 10)) : null;
  const gridCols = `minmax(180px, 260px) repeat(${totalDays}, minmax(22px, 1fr))`;

  return (
    <div className="overflow-auto rounded-md border">
      <div className="grid min-w-[920px] gap-px bg-muted/30" style={{ gridTemplateColumns: gridCols }}>
        <div className="sticky left-0 z-10 bg-background p-2 text-xs font-semibold text-muted-foreground">
          Obligación
        </div>
        {days.map((day) => (
          <div
            key={day}
            className={`p-1 text-center text-[11px] font-semibold ${day === todayNum ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
          >
            {day}
          </div>
        ))}
        {documents.length === 0 && (
          <div className="col-span-full bg-background py-8 text-center text-sm text-muted-foreground">
            Sin obligaciones para este mes.
          </div>
        )}
        {documents.map((doc) => {
          const meta = legalDocumentTypeMeta(doc.type);
          const dueDay = Number(doc.dueDate.slice(8, 10));
          return (
            <div key={doc.id} className="contents">
              <button
                type="button"
                className="sticky left-0 z-10 truncate bg-background p-2 text-left text-xs hover:underline"
                title={doc.description}
                onClick={() => onOpen(doc)}
              >
                {doc.description}
              </button>
              {days.map((day) => (
                <div key={day} className="bg-background p-1">
                  {day === dueDay && (
                    <div className={`h-5 rounded ${meta.dot} ${doc.paid ? "opacity-40" : ""}`} title={formatCurrency(doc.amount)} />
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
