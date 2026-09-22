"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVITY_TABLE_HEADERS } from "@/modules/sig/business/procedure-sections";

export type ProcedureStageView = {
  id: string;
  sortOrder: number;
  title: string;
  body: string;
  responsible: string | null;
  sectionKey?: string | null;
};

export type ProcedureSectionView = {
  id: string;
  sectionKey: string | null;
  number: string | null;
  title: string;
  titleLocked: boolean;
  kind: "prose" | "flowchart" | "activities";
  body: string;
  responsible: string | null;
  level: number;
};

export type ProcedureActivityView = {
  id: string;
  sortOrder: number;
  code: string;
  name: string;
  description: string;
  documents: string | null;
  responsible: string | null;
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
  activities?: ProcedureActivityView[];
  flowchartUrl?: string | null;
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

function ActivitiesTable({ rows }: { rows: ProcedureActivityView[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Sin actividades registradas en la tabla.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto border border-neutral-400">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-neutral-200">
            {ACTIVITY_TABLE_HEADERS.map((h) => (
              <th
                key={h}
                className="border border-neutral-400 px-2 py-2 font-semibold text-center align-middle"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="border border-neutral-400 px-2 py-2 text-center font-medium w-[18%]">
                <span className="block">{r.code}</span>
                <span className="block font-normal">{r.name}</span>
              </td>
              <td className="border border-neutral-400 px-2 py-2 whitespace-pre-wrap w-[42%]">
                {r.description}
              </td>
              <td className="border border-neutral-400 px-2 py-2 whitespace-pre-wrap w-[22%]">
                {r.documents || "—"}
              </td>
              <td className="border border-neutral-400 px-2 py-2 text-center w-[18%]">
                {r.responsible || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  const activities = data.activities ?? [];
  const hasContent = sections.length > 0 || activities.length > 0;
  const canPersist = canEdit && data.sectionsFromPreview && !!data.extractedText;
  const canEditNow = canEdit && (data.hasStructuredContent || hasContent);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 border-b">
        <CardTitle className="text-base flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {data.documentType?.name ?? "Documento"} · formato corporativo Alfa
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
        {hasContent ? (
          <article className="px-5 py-5 space-y-7 max-w-4xl mx-auto">
            {data.sectionsFromPreview && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                Vista generada desde el archivo con secciones fijas Alfa y tabla de actividades.
                {canEdit
                  ? " «Editar» modifica el contenido (no los títulos). «Guardar estructura» la persiste."
                  : ""}
              </p>
            )}

            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold">{data.title}</h2>
              <div className="h-0.5 w-full bg-gradient-to-r from-red-700 via-red-600 to-neutral-400" />
            </div>

            <p className="text-[11px] uppercase tracking-wide text-muted-foreground border-l-2 border-red-700/70 pl-3">
              Copia no controlada — consulta y capacitación.
            </p>

            {sections.map((s) => (
              <section key={s.id} className="space-y-3">
                <h3 className="text-base font-semibold border-b border-neutral-300 pb-1">
                  {s.number}. {s.title}
                </h3>

                {s.kind === "flowchart" && (
                  <div className="rounded border border-dashed border-neutral-400 bg-neutral-50 min-h-[220px] flex items-center justify-center p-4">
                    {data.flowchartUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.flowchartUrl}
                        alt="Diagrama de flujo"
                        className="max-h-[480px] max-w-full object-contain"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground text-center">
                        Área del diagrama de flujo
                        <br />
                        <span className="text-xs">Aún no hay imagen cargada</span>
                      </p>
                    )}
                  </div>
                )}

                {s.kind === "activities" && <ActivitiesTable rows={activities} />}

                {s.kind === "prose" && s.body.trim() && (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {s.body}
                  </div>
                )}
              </section>
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
