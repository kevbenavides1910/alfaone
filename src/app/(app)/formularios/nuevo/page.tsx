"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NuevoFormularioPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passScorePercent, setPassScorePercent] = useState("80");

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/formularios", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          title: title.trim(),
          description: description.trim() || null,
          passScorePercent: Number(passScorePercent) || 80,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al crear");
      }
      return r.json() as Promise<{ data: { id: string } }>;
    },
    onSuccess: (res) => {
      router.push(`/formularios/${res.data.id}`);
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo formulario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Código</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="QUIZ-SIG-2026-v1"
              className="font-mono"
            />
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
          <div className="w-32">
            <Label>% mínimo aprobación</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={passScorePercent}
              onChange={(e) => setPassScorePercent(e.target.value)}
            />
          </div>
          {createMut.isError && (
            <p className="text-sm text-red-600">{(createMut.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => createMut.mutate()}
              disabled={!code.trim() || !title.trim() || createMut.isPending}
            >
              {createMut.isPending ? "Creando…" : "Crear y editar preguntas"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/formularios")}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
