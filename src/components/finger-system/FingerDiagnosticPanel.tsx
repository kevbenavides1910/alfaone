"use client";

import type { FingerDiagnosticItem } from "@/modules/finger-system/services/finger-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABEL: Record<FingerDiagnosticItem["status"], string> = {
  ok: "🟢",
  warn: "🟡",
  error: "🔴",
};

export function FingerDiagnosticPanel({ items }: { items: FingerDiagnosticItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Diagnóstico del sistema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3 rounded-lg border border-slate-100 p-3">
            <span className="text-lg leading-none">{STATUS_LABEL[item.status]}</span>
            <div>
              <p className="font-medium text-slate-900">{item.label}</p>
              <p className="text-sm text-slate-600">{item.message}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
