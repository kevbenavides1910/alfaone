"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import {
  NAF_REPORT_DETAIL_SECTIONS,
  formatNafReportCell,
  type NafEmployeeReportRow,
} from "@/modules/empleados-naf/business/report-fields";

interface NafEmployeeDetail extends NafEmployeeReportRow {
  sourceKey: string;
  estado: string | null;
  area: string | null;
  depto: string | null;
  zonaCode: string | null;
  payload: Record<string, unknown>;
  syncedAt: string;
  updatedAt: string;
}

const FIELD_LABELS: Record<string, string> = {
  NO_CIA: "Compañía",
  NO_EMPLE: "Código empleado",
  NO_UBICACION: "Ubicación",
  NOMBRE_UBICACION: "Nombre ubicación",
  TIPO_EMP: "Tipo empleado",
  CONTRATO: "Contrato",
  CIA_LABORAL: "Compañía laboral",
  NOMBRE: "Nombre completo",
  NOMBRE_PILA: "Nombre",
  APE_PAT: "Apellido paterno",
  APE_MAT: "Apellido materno",
  ESTADO: "Estado",
  CEDULA: "Cédula",
  GRUPO: "Grupo",
  NACION: "Nación",
  ASEGU: "Aseguradora",
  FORMA_PAGO: "Forma de pago",
  ID_CTA: "ID cuenta",
  TIPO_CTA: "Tipo cuenta",
  NUM_CUENTA: "Número cuenta",
  BANCO: "Banco",
  TELEFONO: "Teléfono",
  DIRECCION: "Dirección",
  F_INGRESO: "Fecha ingreso",
  F_EGRESO: "Fecha egreso",
  F_NACIMI: "Fecha nacimiento",
  AREA: "Área",
  DEPTO: "Departamento",
  DESCRIPCION_AREA: "Descripción área",
  DESCRIPCION_DEPA: "Descripción departamento",
  PUESTO: "Puesto",
  DESCRIPCION_PUESTO: "Descripción puesto",
  SEXO: "Sexo",
  CATEGORIA: "Clase",
  TITULO: "Título",
  NOMBRE_TITULO: "Nombre título",
  COD_PLA: "Nómina",
  DESCRI_NOMINA: "Nombre nómina",
  NO_ROL: "No rol",
  CORREO_ELECTRONICO: "Correo electrónico",
  CORREO: "Correo",
  IND_OFICIAL: "Oficial",
  SAL_BAS: "Salario base",
  JORNADA: "Jornada",
  E_CIVIL: "Estado civil",
};

function formatPayloadValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return formatDate(value);
  }
  return String(value);
}

function formatDetailField(
  employee: NafEmployeeDetail,
  key: (typeof NAF_REPORT_DETAIL_SECTIONS)[number]["fields"][number]["key"],
): string {
  if (key === "estado") return employee.estado ?? "—";
  if (key === "area") return employee.area ?? "—";
  if (key === "depto") return employee.depto ?? "—";
  if (key === "zonaCode") return employee.zonaCode ?? "—";
  return formatNafReportCell(employee, key);
}

export default function EmpleadoNafDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const sourceKey = decodeURIComponent(key);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["empleado-naf", sourceKey],
    queryFn: async () => {
      const res = await fetch(`/api/empleados-naf/${encodeURIComponent(sourceKey)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Error");
      return (await res.json()) as { data: NafEmployeeDetail };
    },
  });

  const employee = data?.data;
  const payloadEntries = employee
    ? Object.entries(employee.payload).sort(([a], [b]) => a.localeCompare(b))
    : [];
  const reportFieldKeys = new Set(
    NAF_REPORT_DETAIL_SECTIONS.flatMap((s) => s.fields.map((f) => f.key)),
  );
  const extraPayloadEntries = payloadEntries.filter(([field]) => {
    const upper = field.toUpperCase();
    return !reportFieldKeys.has(field as never) && !FIELD_LABELS[upper];
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="flex-1 p-4 md:p-6 space-y-4 max-w-5xl mx-auto w-full">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/empleados-naf">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver al directorio NAF
          </Link>
        </Button>

        {isLoading && <div className="text-slate-500">Cargando…</div>}
        {isError && <div className="text-rose-600">No se pudo cargar el empleado.</div>}
        {!isLoading && !employee && (
          <div className="text-slate-500">Empleado no encontrado en la réplica local.</div>
        )}

        {employee && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {employee.nombre ?? employee.noEmple}
                  {employee.estado?.toUpperCase() === "A" ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Activo</Badge>
                  ) : employee.estado?.toUpperCase() === "I" ? (
                    <Badge variant="secondary">Inactivo</Badge>
                  ) : employee.estado?.toUpperCase() === "B" ? (
                    <Badge variant="outline">Baja</Badge>
                  ) : (
                    <Badge variant="secondary">{employee.estado ?? "—"}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-1">
                <p>
                  Código: <span className="font-mono">{employee.noEmple}</span> · Compañía:{" "}
                  {employee.noCia}
                </p>
                <p className="text-xs text-slate-500">
                  Sincronizado: {formatDateTime(employee.syncedAt)}
                </p>
              </CardContent>
            </Card>

            {NAF_REPORT_DETAIL_SECTIONS.map((section) => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    {section.fields.map((field) => (
                      <div key={field.key}>
                        <dt className="text-xs text-slate-500">{field.label}</dt>
                        <dd className="text-sm text-slate-900 mt-0.5 break-words">
                          {formatDetailField(employee, field.key)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            ))}

            {extraPayloadEntries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Otros datos del maestro NAF</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    {extraPayloadEntries.map(([field, value]) => (
                      <div key={field}>
                        <dt className="text-xs text-slate-500">
                          {FIELD_LABELS[field] ?? field}
                        </dt>
                        <dd className="text-sm text-slate-900 mt-0.5 break-words">
                          {formatPayloadValue(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
