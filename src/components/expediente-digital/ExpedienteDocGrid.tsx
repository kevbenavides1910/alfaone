"use client";

import { BookMarked } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ExpedienteDocumento } from "@/modules/expediente-digital/business/types";
import { formatExpedienteVigencia } from "@/components/expediente-digital/expediente-display";

type Props = {
  docs: ExpedienteDocumento[];
  selectedKey: string | null;
  onSelect: (doc: ExpedienteDocumento) => void;
  className?: string;
};

export function docKey(doc: ExpedienteDocumento): string {
  return `${doc.tipoDoc}|${doc.noEmple}|${doc.nVersion}`;
}

export function ExpedienteDocGrid({ docs, selectedKey, onSelect, className }: Props) {
  if (docs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500">
        Sin documentos registrados.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
        className,
      )}
    >
      {docs.map((doc) => {
        const key = docKey(doc);
        const active = selectedKey === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(doc)}
            className={cn(
              "group flex flex-col items-center rounded-xl border bg-white px-2.5 pb-3 pt-4 text-center shadow-sm transition",
              "hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40",
              active ? "border-red-500 ring-2 ring-red-500/30" : "border-slate-200",
            )}
          >
            <div className="relative mb-2 flex h-16 w-14 items-center justify-center">
              <div className="absolute inset-0 rounded-md bg-gradient-to-b from-slate-800 to-slate-950 shadow-inner" />
              <div className="absolute inset-x-1 top-1 bottom-1 rounded-sm bg-slate-100/95" />
              <div className="relative z-[1] flex flex-col items-center">
                <BookMarked className="h-6 w-6 text-slate-800" strokeWidth={1.75} />
                <span className="mt-0.5 text-[9px] font-black tracking-wide text-red-600">ALFA</span>
              </div>
            </div>

            <div className="line-clamp-1 w-full text-[11px] font-bold uppercase tracking-wide text-slate-900">
              {doc.tipoDoc}
            </div>
            <div className="mt-0.5 line-clamp-3 min-h-[3.2rem] w-full text-[10px] leading-snug text-slate-600">
              {doc.tipoDescripcion || "Documento"}
            </div>
            <div className="mt-1 text-[10px] font-medium text-slate-500">
              Versión: {doc.nVersion}
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-400">
              Archivo Digital
            </div>
            <div className="mt-1 line-clamp-1 w-full text-[9px] text-slate-400">
              {formatExpedienteVigencia(doc.venceDesde, doc.venceHasta)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
