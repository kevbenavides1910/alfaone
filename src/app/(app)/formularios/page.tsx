"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardList, Pencil, Play, BarChart3 } from "lucide-react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissions/check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";

type FormRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  passScorePercent: number;
  isActive: boolean;
  updatedAt: string;
  _count: { questions: number; submissions: number };
};

export default function FormulariosPage() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session, "formularios.editor", "edit");
  const canResults = hasPermission(session, "formularios.resultados", "view");
  const [q, setQ] = useState("");

  const listUrl = `/api/formularios?page=1&pageSize=50${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`;

  const { data, isLoading } = useQuery({
    queryKey: ["formularios", listUrl],
    queryFn: async () => {
      const r = await fetch(listUrl, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar formularios");
      return r.json() as Promise<{ data: { rows: FormRow[]; total: number } }>;
    },
  });

  const rows = data?.data.rows ?? [];

  return (
    <ModulePage>
      <ModulePageHeader
        title="Formularios y quizzes"
        description="Encuestas editables con preguntas de opción múltiple, verdadero/falso y texto libre."
        icon={ClipboardList}
        actions={
          canEdit ? (
            <Button asChild>
              <Link href="/formularios/nuevo">Nuevo formulario</Link>
            </Button>
          ) : undefined
        }
      />

      <Input
        placeholder="Buscar por código o título…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">No hay formularios registrados</p>
            {canEdit && (
              <Button size="sm" className="mt-4" asChild>
                <Link href="/formularios/nuevo">Crear formulario</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="transition-shadow duration-200 hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{row.title}</CardTitle>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{row.code}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {row.isActive ? (
                        <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {row.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{row.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {row._count.questions} preguntas · {row._count.submissions} envíos · Aprobación{" "}
                    {row.passScorePercent}%
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {row.isActive && (
                      <Button size="sm" asChild>
                        <Link href={`/formularios/${row.id}/responder`}>
                          <Play className="h-3.5 w-3.5 mr-1" />
                          Responder
                        </Link>
                      </Button>
                    )}
                    {canEdit && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/formularios/${row.id}`}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Link>
                      </Button>
                    )}
                    {canResults && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/formularios/${row.id}/resultados`}>
                          <BarChart3 className="h-3.5 w-3.5 mr-1" />
                          Resultados
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </ModulePage>
  );
}
