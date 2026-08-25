"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

type Props = {
  title: string;
  description: string;
  phase?: string;
};

export function FingerPlaceholderPage({ title, description, phase = "Fase 2+" }: Props) {
  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Construction className="h-5 w-5 text-teal-600" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>{description}</p>
          <p className="text-xs text-slate-400">Próxima entrega: {phase}</p>
        </CardContent>
      </Card>
    </div>
  );
}
