"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "TEXT";

export type OptionDraft = {
  label: string;
  isCorrect: boolean;
};

export type QuestionDraft = {
  id?: string;
  text: string;
  type: QuestionType;
  points: number;
  isCritical: boolean;
  correctTrueFalse: boolean | null;
  options: OptionDraft[];
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Opción única",
  MULTIPLE_CHOICE: "Opción múltiple",
  TRUE_FALSE: "Verdadero / Falso",
  TEXT: "Texto libre",
};

export function emptyQuestion(): QuestionDraft {
  return {
    text: "",
    type: "SINGLE_CHOICE",
    points: 1,
    isCritical: false,
    correctTrueFalse: true,
    options: [
      { label: "", isCorrect: false },
      { label: "", isCorrect: false },
    ],
  };
}

type Props = {
  draft: QuestionDraft;
  index: number;
  onChange: (draft: QuestionDraft) => void;
  onSave: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  saving?: boolean;
  isNew?: boolean;
};

export function QuestionEditor({
  draft,
  index,
  onChange,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  saving,
  isNew,
}: Props) {
  const needsOptions = draft.type === "SINGLE_CHOICE" || draft.type === "MULTIPLE_CHOICE";

  function setType(type: QuestionType) {
    const next = { ...draft, type };
    if (type === "TRUE_FALSE") {
      next.options = [];
      next.correctTrueFalse = draft.correctTrueFalse ?? true;
    } else if (type === "TEXT") {
      next.options = [];
    } else if (next.options.length < 2) {
      next.options = [
        { label: "", isCorrect: false },
        { label: "", isCorrect: false },
      ];
    }
    onChange(next);
  }

  function setOptionCorrect(idx: number, isCorrect: boolean) {
    const options = draft.options.map((o, i) => {
      if (draft.type === "SINGLE_CHOICE") {
        return { ...o, isCorrect: i === idx ? isCorrect : false };
      }
      if (i === idx) return { ...o, isCorrect };
      return o;
    });
    onChange({ ...draft, options });
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">Pregunta {index + 1}</span>
        <div className="flex gap-1">
          {onMoveUp && (
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onMoveUp}>
              <ChevronUp className="h-4 w-4" />
            </Button>
          )}
          {onMoveDown && (
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onMoveDown}>
              <ChevronDown className="h-4 w-4" />
            </Button>
          )}
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-xs">Enunciado</Label>
        <textarea
          className="w-full rounded-md border px-3 py-2 text-sm min-h-16"
          value={draft.text}
          onChange={(e) => onChange({ ...draft, text: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[180px]">
          <Label className="text-xs">Tipo</Label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm h-9"
            value={draft.type}
            onChange={(e) => setType(e.target.value as QuestionType)}
          >
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-20">
          <Label className="text-xs">Puntos</Label>
          <Input
            type="number"
            min={0}
            value={draft.points}
            onChange={(e) => onChange({ ...draft, points: Number(e.target.value) || 1 })}
          />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={draft.isCritical}
            onChange={(e) => onChange({ ...draft, isCritical: e.target.checked })}
          />
          Pregunta crítica
        </label>
      </div>

      {draft.type === "TRUE_FALSE" && (
        <div>
          <Label className="text-xs">Respuesta correcta</Label>
          <select
            className="w-full max-w-xs rounded-md border px-3 py-2 text-sm h-9"
            value={draft.correctTrueFalse === false ? "false" : "true"}
            onChange={(e) =>
              onChange({ ...draft, correctTrueFalse: e.target.value === "true" })
            }
          >
            <option value="true">Verdadero</option>
            <option value="false">Falso</option>
          </select>
        </div>
      )}

      {needsOptions && (
        <div className="space-y-2">
          <Label className="text-xs">Opciones (marque la(s) correcta(s))</Label>
          {draft.options.map((opt, oi) => (
            <div key={oi} className="flex gap-2 items-start">
              <input
                type={draft.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                name={`q-${index}-correct`}
                checked={opt.isCorrect}
                onChange={(e) => setOptionCorrect(oi, e.target.checked)}
                className="mt-2.5"
              />
              <Input
                value={opt.label}
                onChange={(e) => {
                  const options = [...draft.options];
                  options[oi] = { ...options[oi], label: e.target.value };
                  onChange({ ...draft, options });
                }}
                placeholder={`Opción ${String.fromCharCode(65 + oi)}`}
                className="flex-1"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0 text-red-600"
                disabled={draft.options.length <= 2}
                onClick={() => {
                  const options = draft.options.filter((_, i) => i !== oi);
                  onChange({ ...draft, options });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({
                ...draft,
                options: [...draft.options, { label: "", isCorrect: false }],
              })
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Agregar opción
          </Button>
        </div>
      )}

      {draft.type === "TEXT" && (
        <p className="text-xs text-slate-500">
          Las preguntas de texto libre no se califican automáticamente.
        </p>
      )}

      <Button
        type="button"
        size="sm"
        onClick={onSave}
        disabled={!draft.text.trim() || saving}
        className={cn(isNew && "bg-indigo-700 hover:bg-indigo-800")}
      >
        <Save className="h-3.5 w-3.5 mr-1" />
        {saving ? "Guardando…" : isNew ? "Agregar pregunta" : "Guardar pregunta"}
      </Button>
    </div>
  );
}
