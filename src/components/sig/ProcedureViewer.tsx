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

export type ProcedureContentData = {
  documentId: string;
  hasStructuredContent: boolean;
  showAsProcedure: boolean;
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

function ProseBlock({ title, text }: { title: string; text: string | null | undefined }) {
  if (!text?.trim()) return null;
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold tracking-wide text-foreground/80 uppercase">{title}</h3>
      <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{text}</p>
    </section>
  );
}

type Props = {
  data: ProcedureContentData;
  canEdit: boolean;
  onEdit: () => void;
  onRequestChange: () => void;
  onBootstrap: () => void;
  bootstrapping?: boolean;
};

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

  const hasBody =
    data.body &&
    (data.body.objective || data.body.scope || data.body.responsibilities || data.body.definitions);
  const hasStages = data.stages.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex flex-wrap items-center justify-between gap-2">
          <span>Procedimiento</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onRequestChange}>
              Solicitar cambio
            </Button>
            {canEdit && hasStages && (
              <Button size="sm" onClick={onEdit}>
                Editar
              </Button>
            )}
            {canEdit && !hasStages && data.extractedText && (
              <Button size="sm" onClick={onBootstrap} disabled={bootstrapping}>
                {bootstrapping ? "Convirtiendo…" : "Convertir a procedimiento"}
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasStages || hasBody ? (
          <>
            <div className="space-y-4">
              <ProseBlock title="Objetivo" text={data.body?.objective} />
              <ProseBlock title="Alcance" text={data.body?.scope} />
              <ProseBlock title="Responsabilidades" text={data.body?.responsibilities} />
              <ProseBlock title="Definiciones" text={data.body?.definitions} />
            </div>
            {hasStages && (
              <ol className="space-y-5 list-none counter-reset-etapa">
                {data.stages.map((s, idx) => (
                  <li key={s.id} className="border-l-2 border-teal-600/40 pl-4">
                    <p className="text-xs text-muted-foreground mb-0.5">Etapa {idx + 1}</p>
                    <h3 className="font-semibold text-base">{s.title}</h3>
                    {s.responsible && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Responsable: {s.responsible}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed mt-2">{s.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : data.extractedText ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Texto indexado del archivo. {canEdit ? "Conviértalo a etapas editables." : "Aún no hay procedimiento estructurado."}
            </p>
            <div className="rounded-md border bg-muted/30 p-4 max-h-[28rem] overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {data.extractedText}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin contenido en prosa todavía. Descargue el archivo o espere a que se indexe el texto.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
