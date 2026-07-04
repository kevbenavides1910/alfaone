"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";
import { hasPermission } from "@/lib/permissions/check";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/components/formularios/QuestionEditor";

type SubmissionRow = {
  id: string;
  scorePercent: number | null;
  passed: boolean | null;
  submittedAt: string;
  user: { id: string; name: string; email: string };
};

type AnswerDetail = {
  id: string;
  sortOrder: number;
  questionText: string;
  questionType: QuestionType;
  points: number;
  isCritical: boolean;
  givenAnswer: string;
  correctAnswer: string;
  isCorrect: boolean | null;
};

type SubmissionDetail = {
  id: string;
  scorePercent: number | null;
  passed: boolean | null;
  submittedAt: string;
  user: { name: string; email: string };
  answers: AnswerDetail[];
};

function SubmissionDetailPanel({ formId, submissionId }: { formId: string; submissionId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["formulario-envio", formId, submissionId],
    queryFn: async () => {
      const r = await fetch(`/api/formularios/${formId}/resultados/${submissionId}`, {
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("Error al cargar detalle");
      return r.json() as Promise<{ data: SubmissionDetail }>;
    },
  });

  if (isLoading) return <p className="text-sm text-slate-500 py-3">Cargando respuestas…</p>;
  if (error || !data) {
    return <p className="text-sm text-red-600 py-3">No se pudo cargar el detalle.</p>;
  }

  const detail = data.data;

  return (
    <div className="py-3 space-y-3 border-t bg-slate-50/80 -mx-4 px-4 sm:mx-0 sm:px-0 sm:bg-transparent sm:border-t-0">
      <ol className="space-y-2 list-none">
        {detail.answers.map((a, index) => (
          <li
            key={a.id}
            className={cn(
              "rounded-lg border p-3 text-sm bg-white",
              a.isCorrect === true && "border-emerald-200",
              a.isCorrect === false && "border-red-200",
              a.isCorrect === null && "border-slate-200"
            )}
          >
            <div className="flex flex-wrap items-start gap-2 justify-between mb-2">
              <p className="font-medium text-slate-800 flex-1 min-w-0">
                {index + 1}. {a.questionText}
              </p>
              <div className="flex flex-wrap gap-1 shrink-0">
                {a.isCritical && (
                  <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
                    Crítica
                  </Badge>
                )}
                {a.isCorrect === true && (
                  <Badge className="bg-emerald-600 text-xs">Correcta</Badge>
                )}
                {a.isCorrect === false && (
                  <Badge variant="destructive" className="text-xs">Incorrecta</Badge>
                )}
                {a.isCorrect === null && (
                  <Badge variant="outline" className="text-xs">Sin calificar</Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-2">{QUESTION_TYPE_LABELS[a.questionType]}</p>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-slate-50 border px-3 py-2">
                <p className="text-xs text-slate-500 mb-0.5">Respuesta del usuario</p>
                <p className="text-slate-800">{a.givenAnswer}</p>
              </div>
              {a.isCorrect !== null && (
                <div className="rounded-md bg-slate-50 border px-3 py-2">
                  <p className="text-xs text-slate-500 mb-0.5">Respuesta correcta</p>
                  <p className="text-slate-800">{a.correctAnswer}</p>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function ResultadosFormularioPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const canView = hasPermission(session, "formularios.resultados", "view");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: formData } = useQuery({
    queryKey: ["formulario-meta", id],
    enabled: canView,
    queryFn: async () => {
      const r = await fetch(`/api/formularios/${id}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error");
      return r.json() as Promise<{ data: { title: string; code: string } }>;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["formulario-resultados", id],
    enabled: canView,
    queryFn: async () => {
      const r = await fetch(`/api/formularios/${id}/resultados?page=1&pageSize=100`, {
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("Error al cargar resultados");
      return r.json() as Promise<{ data: { rows: SubmissionRow[]; total: number } }>;
    },
  });

  const rows = data?.data.rows ?? [];
  const form = formData?.data;

  if (!canView) {
    return (
      <div className="p-6 text-sm text-slate-600">
        No tiene permiso para ver resultados de este formulario.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Resultados</h1>
          {form && (
            <p className="text-sm text-slate-600">
              {form.title} <span className="font-mono text-xs">({form.code})</span>
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/formularios/${id}`}>Editar formulario</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            Aún no hay envíos registrados.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{rows.length} envío(s)</CardTitle>
            <p className="text-xs text-slate-500 font-normal">
              Haga clic en una fila para ver las respuestas pregunta por pregunta.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.map((row) => {
              const open = expandedId === row.id;
              return (
                <div key={row.id} className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : row.id)}
                    className="w-full flex flex-wrap items-center gap-3 p-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-[140px]">
                      <div className="font-medium text-slate-900">{row.user.name}</div>
                      <div className="text-xs text-slate-500">{row.user.email}</div>
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(row.submittedAt).toLocaleString("es-CR")}
                    </div>
                    <div className="font-semibold text-slate-800 w-12 text-right">
                      {row.scorePercent ?? "—"}%
                    </div>
                    {row.passed ? (
                      <Badge className="bg-emerald-600">Aprobado</Badge>
                    ) : (
                      <Badge variant="destructive">No aprobado</Badge>
                    )}
                    {!open && (
                      <span className="text-xs text-indigo-600 flex items-center gap-1 ml-auto">
                        <Eye className="h-3.5 w-3.5" />
                        Ver respuestas
                      </span>
                    )}
                  </button>
                  {open && <div className="px-3 pb-3"><SubmissionDetailPanel formId={id} submissionId={row.id} /></div>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
