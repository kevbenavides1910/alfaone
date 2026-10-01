"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { legalDocumentTypeMeta } from "@/modules/documentos-legales/business/catalog";
import type { LegalDocumentDto } from "@/modules/documentos-legales/business/dto";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type Group = {
  key: string;
  label: string;
  chip: string;
  total: number;
  paid: number;
  pending: number;
  items: LegalDocumentDto[];
};

export function LegalReporteMensual({ documents }: { documents: LegalDocumentDto[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => {
    const map = new Map<string, LegalDocumentDto[]>();
    for (const doc of documents) {
      const list = map.get(doc.typeLabel) ?? [];
      list.push(doc);
      map.set(doc.typeLabel, list);
    }
    const result: Group[] = [];
    for (const [label, items] of map) {
      items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.description.localeCompare(b.description, "es"));
      const total = items.reduce((sum, item) => sum + item.amount, 0);
      const paid = items.filter((item) => item.paid).reduce((sum, item) => sum + item.amount, 0);
      const meta = legalDocumentTypeMeta(items[0]?.type ?? "OTRO");
      result.push({
        key: label,
        label,
        chip: meta.chip,
        total,
        paid,
        pending: total - paid,
        items,
      });
    }
    return result.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
  }, [documents]);

  if (groups.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No hay obligaciones para este mes.</p>;
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const expanded = open[group.key] ?? false;
        return (
          <section key={group.key} className="rounded-md border">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-left"
              onClick={() => setOpen((current) => ({ ...current, [group.key]: !expanded }))}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className={`rounded border px-1.5 text-xs ${group.chip}`}>{group.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                Pendiente {formatCurrency(group.pending)} · Pagado {formatCurrency(group.paid)} · Total {formatCurrency(group.total)}
              </span>
            </button>
            {expanded && (
              <table className="w-full border-t text-sm">
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="whitespace-nowrap px-3 py-1.5">{formatDate(item.dueDate)}</td>
                      <td className="px-3 py-1.5">{item.description}</td>
                      <td className="whitespace-nowrap px-3 py-1.5">{item.responsibleName}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right">{formatCurrency(item.amount)}</td>
                      <td className="whitespace-nowrap px-3 py-1.5">{item.paid ? "Pagado" : "Pendiente"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
