"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botón de acceso al Visualizador de Reportes (Centro de Operaciones). */
export function ReportViewerLauncher() {
  return (
    <Button variant="outline" className="gap-2" asChild>
      <Link href="/tickets-ti/visualizador">
        <BarChart3 className="h-4 w-4" />
        Visualizador de Reportes
      </Link>
    </Button>
  );
}
