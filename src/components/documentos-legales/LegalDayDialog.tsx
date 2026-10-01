"use client";

import { legalDocumentTypeMeta } from "@/modules/documentos-legales/business/catalog";
import type { LegalDocumentDto } from "@/modules/documentos-legales/business/dto";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function LegalDayDialog({
  date,
  documents,
  canEdit,
  onClose,
  onCreate,
  onEdit,
  onTogglePaid,
}: {
  date: string | null;
  documents: LegalDocumentDto[];
  canEdit: boolean;
  onClose: () => void;
  onCreate: (date: string) => void;
  onEdit: (doc: LegalDocumentDto) => void;
  onTogglePaid: (doc: LegalDocumentDto) => void;
}) {
  return (
    <Dialog open={!!date} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{date ? formatDate(date) : "Día"}</DialogTitle>
        </DialogHeader>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay obligaciones este día.</p>
        ) : (
          <ul className="max-h-[50vh] space-y-2 overflow-auto">
            {documents.map((doc) => {
              const meta = legalDocumentTypeMeta(doc.type);
              return (
                <li key={doc.id} className="rounded-md border p-2">
                  <button type="button" className="w-full text-left" onClick={() => onEdit(doc)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded border px-1.5 text-xs ${meta.chip}`}>{doc.typeLabel}</span>
                      <span className="text-sm font-medium">{formatCurrency(doc.amount)}</span>
                    </div>
                    <p className="mt-1 text-sm">{doc.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.responsibleName}
                      {doc.paid ? " · Pagado" : " · Pendiente"}
                    </p>
                  </button>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => onTogglePaid(doc)}
                    >
                      {doc.paid ? "Marcar pendiente" : "Marcar pagado"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {canEdit && date && (
            <Button type="button" onClick={() => onCreate(date)}>
              Agregar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
