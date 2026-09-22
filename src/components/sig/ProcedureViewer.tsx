"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ProcedureStageView = {
  id: string;
  sortOrder: number;
  title: string;
  body: string;
  responsible: string | null;
};

export type ProcedureSectionView = {
  id: string;
  number: string | null;
  title: string;
  body: string;
  responsible: string | null;
  level: number;
};

export type ProcedureContentData = {
  documentId: string;
  code?: string;
  title?: string;
  documentType?: { id: string; code: string; name: string };
  versionLabel?: string | null;
  hasStructuredContent: boolean;
  showAsProcedure: boolean;
  sections?: ProcedureSectionView[];
  sectionsFromPreview?: boolean;
  body: {
    objective: string | null;
    scope: string | null;
    responsibilities: string | null;
    definitions: string | null;
  } | null;
  stages: ProcedureStageView[];
  extractedText: string | null;
  downloadUrl: string | null;
};

type Props = {
  data: ProcedureContentData;
  canEdit: boolean;
  onEdit: () => void;
  onRequestChange: () => void;
  onBootstrap: () => void;
  bootstrapping?: boolean;
};

function SectionBlock({ section }: { section: ProcedureSectionView }) {
  const heading =
    section.number != null && section.number !== ""
      ? `${section.number}. ${section.title}`
      : section.title;
  const pad = Math.min(Math.max(section.level - 1, 0), 3) * 12;

  return (
    <section className="scroll-mt-4" style={{ paddingLeft: pad }}>
      <h3
        className={
          section.level <= 1
            ? "text-base font-semibold text-foreground border-b border-border/60 pb-1 mb-2"
            : "text-sm font-semibold text-foreground mb-1.5"
        }
      >
        {heading}
      </h3>
      {section.responsible && (
        <p className="text-xs text-muted-foreground mb-1">Responsable: {section.responsible}</p>
      )}
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
        {section.body}
      </div>
    </section>
  );
}

export function ProcedureViewer({
  data,
  canEdit,
  onEdit,
  onRequestChange,
  onBootstrap,
  bootstrapping,
}: Props) {
  if (!data.showAsProcedure && !data.hasStructuredContent && !data.extractedText) {
    return null;
  }

  const sections = data.sections ?? [];
  const hasSections = sections.length > 0;
  const canPersist = canEdit && data.sectionsFromPreview && !!data.extractedText;
  const canEditNow = canEdit && (data.hasStructuredContent || hasSections);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 border-b">
        <CardTitle className="text-base flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {data.documentType?.name ?? "Documento"} · formato corporativo
            </p>
            <p className="font-semibold truncate">
              {data.code ? `${data.code} — ` : ""}
              {data.title ?? "Procedimiento"}
              {data.versionLabel ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  v{data.versionLabel}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={onRequestChange}>
              Solicitar cambio
            </Button>
            {canEditNow && (
              <Button size="sm" onClick={onEdit}>
                Editar
              </Button>
            )}
            {canPersist && (
              <Button size="sm" variant="secondary" onClick={onBootstrap} disabled={bootstrapping}>
                {bootstrapping ? "Guardando…" : "Guardar estructura editable"}
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {hasSections ? (
          <article className="px-5 py-5 space-y-6 max-w-3xl mx-auto">
            {data.sectionsFromPreview && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                Vista en prosa generada desde el archivo (mismo formato documental Alfa).
                {canEdit
                  ? " Use «Editar» para modificar o «Guardar estructura editable» para persistir las secciones."
                  : ""}
              </p>
            )}
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground border-l-2 border-red-700/70 pl-3">
              Copia no controlada — consulta y capacitación. La copia controlada está en la biblioteca
              documental vigente.
            </p>
            {sections.map((s) => (
              <SectionBlock key={s.id} section={s} />
            ))}
          </article>
        ) : (
          <div className="p-5">
            <p className="text-sm text-muted-foreground">
              Sin contenido en prosa todavía. Descargue el archivo o espere a que se indexe el texto.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
