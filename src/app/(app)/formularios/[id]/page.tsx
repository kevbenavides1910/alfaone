"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  QuestionEditor,
  emptyQuestion,
  type QuestionDraft,
  type QuestionType,
} from "@/components/formularios/QuestionEditor";

type FormDetail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  passScorePercent: number;
  isActive: boolean;
  questions: {
    id: string;
    sortOrder: number;
    type: QuestionType;
    text: string;
    points: number;
    isCritical: boolean;
    correctTrueFalse: boolean | null;
    options: { id: string; label: string; isCorrect: boolean; sortOrder: number }[];
  }[];
};

function questionToDraft(q: FormDetail["questions"][0]): QuestionDraft {
  return {
    id: q.id,
    text: q.text,
    type: q.type,
    points: q.points,
    isCritical: q.isCritical,
    correctTrueFalse: q.correctTrueFalse,
    options: q.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
  };
}

function draftToPayload(draft: QuestionDraft) {
  return {
    text: draft.text,
    type: draft.type,
    points: draft.points,
    isCritical: draft.isCritical,
    correctTrueFalse: draft.type === "TRUE_FALSE" ? draft.correctTrueFalse : null,
    options:
      draft.type === "SINGLE_CHOICE" || draft.type === "MULTIPLE_CHOICE"
        ? draft.options.filter((o) => o.label.trim())
        : [],
  };
}

export default function EditarFormularioPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passScorePercent, setPassScorePercent] = useState("80");
  const [isActive, setIsActive] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, QuestionDraft>>({});
  const [newQuestion, setNewQuestion] = useState<QuestionDraft | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["formulario", id],
    queryFn: async () => {
      const r = await fetch(`/api/formularios/${id}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("No se pudo cargar el formulario");
      return r.json() as Promise<{ data: FormDetail }>;
    },
  });

  const form = data?.data;

  useEffect(() => {
    if (!form) return;
    setCode(form.code);
    setTitle(form.title);
    setDescription(form.description ?? "");
    setPassScorePercent(String(form.passScorePercent));
    setIsActive(form.isActive);
    const map: Record<string, QuestionDraft> = {};
    for (const q of form.questions) {
      map[q.id] = questionToDraft(q);
    }
    setDrafts(map);
  }, [form]);

  const saveMetaMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/formularios/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          title: title.trim(),
          description: description.trim() || null,
          passScorePercent: Number(passScorePercent) || 80,
          isActive,
        }),
      });
      if (!r.ok) throw new Error("Error al guardar");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formulario", id] }),
  });

  const saveQuestionMut = useMutation({
    mutationFn: async ({ qid, draft }: { qid: string; draft: QuestionDraft }) => {
      const r = await fetch(`/api/formularios/${id}/questions/${qid}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(draft)),
      });
      if (!r.ok) throw new Error("Error al guardar pregunta");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formulario", id] }),
  });

  const addQuestionMut = useMutation({
    mutationFn: async (draft: QuestionDraft) => {
      const r = await fetch(`/api/formularios/${id}/questions`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(draft)),
      });
      if (!r.ok) throw new Error("Error al agregar pregunta");
      return r.json();
    },
    onSuccess: () => {
      setNewQuestion(null);
      qc.invalidateQueries({ queryKey: ["formulario", id] });
    },
  });

  const deleteQuestionMut = useMutation({
    mutationFn: async (qid: string) => {
      const r = await fetch(`/api/formularios/${id}/questions/${qid}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("Error al eliminar");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formulario", id] }),
  });

  const reorderMut = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const r = await fetch(`/api/formularios/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionOrder: orderedIds }),
      });
      if (!r.ok) throw new Error("Error al reordenar");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["formulario", id] }),
  });

  const questions = form?.questions ?? [];

  function moveQuestion(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= questions.length) return;
    const ids = questions.map((q) => q.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    reorderMut.mutate(ids);
  }

  if (isLoading) {
    return <p className="p-6 text-sm text-slate-500">Cargando formulario…</p>;
  }

  if (!form) {
    return <p className="p-6 text-sm text-red-600">Formulario no encontrado.</p>;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap gap-2 justify-between items-start">
        <div>
          <h1 className="text-xl font-semibold">Editar formulario</h1>
          <p className="text-sm text-slate-500 font-mono">{form.code}</p>
        </div>
        {isActive && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/formularios/${id}/responder`}>
              <Play className="h-3.5 w-3.5 mr-1" />
              Vista previa
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Código</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
          </div>
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Descripción</Label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm min-h-20"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-32">
              <Label>% aprobación</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={passScorePercent}
                onChange={(e) => setPassScorePercent(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Formulario activo
            </label>
          </div>
          <Button onClick={() => saveMetaMut.mutate()} disabled={saveMetaMut.isPending}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {saveMetaMut.isPending ? "Guardando…" : "Guardar datos"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Preguntas ({questions.length})</h2>

        {questions.map((q, index) => {
          const draft = drafts[q.id] ?? questionToDraft(q);
          return (
            <QuestionEditor
              key={q.id}
              index={index}
              draft={draft}
              onChange={(d) => setDrafts((prev) => ({ ...prev, [q.id]: d }))}
              onSave={() => saveQuestionMut.mutate({ qid: q.id, draft: drafts[q.id] ?? draft })}
              onDelete={() => {
                if (confirm("¿Eliminar esta pregunta?")) deleteQuestionMut.mutate(q.id);
              }}
              onMoveUp={index > 0 ? () => moveQuestion(index, -1) : undefined}
              onMoveDown={index < questions.length - 1 ? () => moveQuestion(index, 1) : undefined}
              saving={saveQuestionMut.isPending}
            />
          );
        })}

        {newQuestion ? (
          <QuestionEditor
            index={questions.length}
            draft={newQuestion}
            isNew
            onChange={setNewQuestion}
            onSave={() => addQuestionMut.mutate(newQuestion)}
            onDelete={() => setNewQuestion(null)}
            saving={addQuestionMut.isPending}
          />
        ) : (
          <Button variant="outline" onClick={() => setNewQuestion(emptyQuestion())}>
            + Agregar pregunta
          </Button>
        )}
      </div>
    </div>
  );
}
