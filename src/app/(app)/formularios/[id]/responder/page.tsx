"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/components/formularios/QuestionEditor";

type TakeForm = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  passScorePercent: number;
  questions: {
    id: string;
    sortOrder: number;
    type: QuestionType;
    text: string;
    points: number;
    isCritical: boolean;
    options: { id: string; label: string }[];
  }[];
};

type AnswerState = {
  selectedOptionIds?: string[];
  trueFalse?: boolean;
  text?: string;
};

type IncorrectAnswer = {
  sortOrder: number;
  questionText: string;
  questionType: QuestionType;
  isCritical: boolean;
  givenAnswer: string;
  correctAnswer: string;
};

type SubmitResult = {
  scorePercent: number;
  passed: boolean;
  incorrectAnswers: IncorrectAnswer[];
};

export default function ResponderFormularioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["formulario-take", id],
    queryFn: async () => {
      const r = await fetch(`/api/formularios/${id}?mode=take`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Formulario no disponible");
      return r.json() as Promise<{ data: TakeForm }>;
    },
  });

  const form = data?.data;

  const submitMut = useMutation({
    mutationFn: async () => {
      const payload = {
        answers: (form?.questions ?? []).map((q) => ({
          questionId: q.id,
          ...answers[q.id],
        })),
      };
      const r = await fetch(`/api/formularios/${id}/submit`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Error al enviar");
      return r.json() as Promise<{ data: SubmitResult }>;
    },
    onSuccess: (res) => setResult(res.data),
  });

  if (isLoading) return <p className="p-6 text-sm text-slate-500">Cargando…</p>;
  if (error || !form) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-red-600">No se pudo cargar el formulario.</p>
        <Button variant="outline" onClick={() => router.push("/formularios")}>
          Volver
        </Button>
      </div>
    );
  }

  if (result) {
    const incorrect = result.incorrectAnswers.slice().sort((a, b) => a.sortOrder - b.sortOrder);

    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-3xl font-bold text-center">{result.scorePercent}%</p>
            <p className="text-center">
              {result.passed ? (
                <Badge className="bg-emerald-600">Aprobado</Badge>
              ) : (
                <Badge variant="destructive">No aprobado</Badge>
              )}
            </p>
            <p className="text-sm text-slate-600 text-center">
              Se requiere {form.passScorePercent}% para aprobar.
            </p>
          </CardContent>
        </Card>

        {incorrect.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Respuestas incorrectas ({incorrect.length})
              </CardTitle>
              <p className="text-xs text-slate-500 font-normal">
                Revise cada pregunta junto con la respuesta correcta.
              </p>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 list-none">
                {incorrect.map((a, index) => (
                  <li
                    key={`${a.sortOrder}-${index}`}
                    className="rounded-lg border border-red-200 bg-red-50/40 p-3 text-sm"
                  >
                    <div className="flex flex-wrap gap-2 items-start mb-2">
                      <p className="font-medium text-slate-800 flex-1">
                        {index + 1}. {a.questionText}
                      </p>
                      {a.isCritical && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
                          Crítica
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{QUESTION_TYPE_LABELS[a.questionType]}</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div className="rounded-md bg-white border border-red-100 px-3 py-2">
                        <p className="text-xs text-red-600 mb-0.5">Su respuesta</p>
                        <p className="text-slate-800">{a.givenAnswer}</p>
                      </div>
                      <div className="rounded-md bg-white border border-emerald-100 px-3 py-2">
                        <p className="text-xs text-emerald-700 mb-0.5">Respuesta correcta</p>
                        <p className="text-slate-800">{a.correctAnswer}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-sm text-emerald-700">
              Todas las respuestas calificadas fueron correctas.
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2 justify-center">
          <Button variant="outline" asChild>
            <Link href="/formularios">Volver al catálogo</Link>
          </Button>
          {!result.passed && (
            <Button
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
            >
              Reintentar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{form.title}</h1>
        <p className="text-xs font-mono text-slate-500">{form.code}</p>
        {form.description && <p className="text-sm text-slate-600 mt-2">{form.description}</p>}
        <p className="text-xs text-slate-500 mt-1">
          {form.questions.length} preguntas · Aprobación {form.passScorePercent}%
        </p>
      </div>

      <ol className="space-y-4 list-none">
        {form.questions.map((q, index) => (
          <li key={q.id}>
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-start">
                  <span className="text-sm font-medium text-slate-800">
                    {index + 1}. {q.text}
                  </span>
                  {q.isCritical && (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
                      Crítica
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400">{QUESTION_TYPE_LABELS[q.type]}</p>

                {(q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE") &&
                  q.options.map((opt) => (
                    <label key={opt.id} className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type={q.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                        name={`q-${q.id}`}
                        checked={(answers[q.id]?.selectedOptionIds ?? []).includes(opt.id)}
                        onChange={(e) => {
                          setAnswers((prev) => {
                            const cur = prev[q.id]?.selectedOptionIds ?? [];
                            if (q.type === "SINGLE_CHOICE") {
                              return { ...prev, [q.id]: { selectedOptionIds: [opt.id] } };
                            }
                            const set = new Set(cur);
                            if (e.target.checked) set.add(opt.id);
                            else set.delete(opt.id);
                            return { ...prev, [q.id]: { selectedOptionIds: [...set] } };
                          });
                        }}
                        className="mt-0.5"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}

                {q.type === "TRUE_FALSE" && (
                  <div className="flex gap-4">
                    {[
                      { val: true, label: "Verdadero" },
                      { val: false, label: "Falso" },
                    ].map(({ val, label }) => (
                      <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={answers[q.id]?.trueFalse === val}
                          onChange={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: { trueFalse: val } }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                )}

                {q.type === "TEXT" && (
                  <textarea
                    className="w-full rounded-md border px-3 py-2 text-sm min-h-20"
                    value={answers[q.id]?.text ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: { text: e.target.value } }))
                    }
                  />
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <div className={cn("flex gap-2 sticky bottom-4 bg-background/95 py-2")}>
        <Button
          onClick={() => submitMut.mutate()}
          disabled={submitMut.isPending}
          className="flex-1 sm:flex-none"
        >
          {submitMut.isPending ? "Enviando…" : "Enviar respuestas"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/formularios">Cancelar</Link>
        </Button>
      </div>
      {submitMut.isError && (
        <p className="text-sm text-red-600">{(submitMut.error as Error).message}</p>
      )}
    </div>
  );
}
