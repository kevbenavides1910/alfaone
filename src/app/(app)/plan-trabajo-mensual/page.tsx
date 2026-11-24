"use client";

import { CalendarRange, ClipboardList } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/card";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function periodoActual(): string {
  const hoy = new Date();
  return `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`;
}

export default function PlanTrabajoMensualPage() {
  const periodo = periodoActual();

  return (
    <>
      <Topbar title="Plan de Trabajo Mensual" />
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <CalendarRange className="h-6 w-6 shrink-0 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Plan de Trabajo Mensual</h1>
            <p className="text-sm text-slate-500">
              Programación mensual de actividades por puesto y responsable.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#fde2d9]">
              <ClipboardList className="h-6 w-6 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Aún no hay planes registrados
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Período actual: <span className="capitalize">{periodo}</span>. El módulo está
                habilitado y listo para configurar los planes de trabajo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
