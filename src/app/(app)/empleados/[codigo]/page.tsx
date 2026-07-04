"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Briefcase,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  UserCircle,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";
import { companySapLabel } from "@/modules/empleados/business/company-sap";

interface Placement {
  id: string;
  companySapCode: string | null;
  contrato: string | null;
  contratoNormalizado: string | null;
  ubicacionCode: string | null;
  ubicacionNombre: string | null;
  puestoNombre: string | null;
  noRol: string | null;
  zona: string | null;
  contract: {
    id: string;
    licitacionNo: string;
    client: string;
    company: string;
    status: string;
  } | null;
}

interface EmployeeDetail {
  id: string;
  codigoEmpleado: string;
  codigoEmpleadoRaw: string | null;
  nombre: string | null;
  cedula: string | null;
  aseguradora: string | null;
  email: string | null;
  telefono: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
  sexo: string | null;
  oficial: boolean;
  estado: string | null;
  formaPago: string | null;
  tipoCuenta: string | null;
  numeroCuenta: string | null;
  tituloCode: string | null;
  tituloNombre: string | null;
  clase: string | null;
  nominaCode: string | null;
  nominaNombre: string | null;
  fechaIngreso: string | null;
  centroCosto: string | null;
  categoria: string | null;
  zona: string | null;
  companySapCode: string | null;
  company: string | null;
  companyEntity: { code: string; name: string; sapCode: string | null } | null;
  lastSourceFilename: string | null;
  updatedAt: string;
  lastImportBatch: {
    id: string;
    filename: string;
    createdAt: string;
  } | null;
  placements: Placement[];
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900 mt-0.5">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

export default function EmpleadoDetailPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = use(params);
  const codigoDecoded = decodeURIComponent(codigo);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["empleado", codigoDecoded],
    queryFn: async () => {
      const res = await fetch(`/api/empleados/${encodeURIComponent(codigoDecoded)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Error");
      return (await res.json()) as { data: EmployeeDetail };
    },
  });

  const employee = data?.data;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Topbar title={`Empleado · ${codigoDecoded}`} />
      <div className="flex-1 p-4 md:p-6 space-y-4 max-w-5xl mx-auto w-full">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/empleados">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver al directorio
          </Link>
        </Button>

        {isLoading && <div className="text-slate-500">Cargando…</div>}
        {isError && <div className="text-rose-600">No se pudo cargar el empleado.</div>}
        {!isLoading && !employee && (
          <div className="text-slate-600">Empleado no encontrado.</div>
        )}

        {employee && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <UserCircle className="h-6 w-6 text-indigo-600" />
                  {employee.nombre ?? "Sin nombre"}
                </h1>
                <p className="text-sm text-slate-600 mt-1 font-mono">
                  Código {employee.codigoEmpleado}
                  {employee.cedula && ` · Cédula ${employee.cedula}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={employee.estado?.toUpperCase() === "A" ? "success" : employee.estado?.toUpperCase() === "I" ? "secondary" : "secondary"}>
                  {employee.estado?.toUpperCase() === "A"
                    ? "Activo"
                    : employee.estado?.toUpperCase() === "I"
                      ? "Inactivo"
                      : employee.estado ?? "Estado N/D"}
                </Badge>
                {employee.oficial && <Badge variant="outline">Oficial</Badge>}
                {employee.zona && <Badge variant="secondary">{employee.zona}</Badge>}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Datos personales</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-3">
                    <Field label="Sexo" value={employee.sexo} />
                    <Field
                      label="Fecha nacimiento"
                      value={employee.fechaNacimiento ? formatDate(employee.fechaNacimiento) : null}
                    />
                    <Field
                      label="Fecha ingreso"
                      value={employee.fechaIngreso ? formatDate(employee.fechaIngreso) : null}
                    />
                    <Field
                      label="Compañía"
                      value={companySapLabel(
                        employee.companySapCode,
                        employee.company ?? employee.companyEntity?.code,
                        employee.companyEntity?.name,
                      )}
                    />
                    <Field label="Centro de costo" value={employee.centroCosto} />
                    <Field label="Categoría" value={employee.categoria} />
                    <Field label="Clase" value={employee.clase} />
                    <Field label="Aseguradora" value={employee.aseguradora} />
                  </dl>
                  <div className="mt-3">
                    <Field label="Dirección" value={employee.direccion} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    {employee.email && (
                      <span className="flex items-center gap-1 text-slate-700">
                        <Mail className="h-4 w-4 text-slate-400" /> {employee.email}
                      </span>
                    )}
                    {employee.telefono && (
                      <span className="flex items-center gap-1 text-slate-700">
                        <Phone className="h-4 w-4 text-slate-400" /> {employee.telefono}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> Nómina y cuenta bancaria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-3">
                    <Field label="Nómina" value={employee.nominaNombre} />
                    <Field label="Cód. nómina" value={employee.nominaCode} />
                    <Field label="Forma de pago" value={employee.formaPago} />
                    <Field label="Tipo cuenta" value={employee.tipoCuenta} />
                    <Field label="Número cuenta" value={employee.numeroCuenta} />
                    <Field label="Título" value={employee.tituloNombre ?? employee.tituloCode} />
                  </dl>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Contratos y ubicaciones ({employee.placements.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {employee.placements.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">Sin asignaciones registradas.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                          <th className="px-4 py-2">Contrato</th>
                          <th className="px-4 py-2">Ubicación</th>
                          <th className="px-4 py-2">Puesto</th>
                          <th className="px-4 py-2">Rol</th>
                          <th className="px-4 py-2">Zona</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employee.placements.map((p) => (
                          <tr key={p.id} className="border-b">
                            <td className="px-4 py-3">
                              {p.contract ? (
                                <Link
                                  href={`/contracts/${p.contract.id}`}
                                  className="text-indigo-600 hover:underline"
                                >
                                  {p.contract.licitacionNo}
                                </Link>
                              ) : (
                                <span className="text-slate-700">{p.contrato ?? "—"}</span>
                              )}
                              {p.contract && (
                                <div className="text-xs text-slate-500">{p.contract.client}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-start gap-1">
                                <MapPin className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
                                <div>
                                  <div>{p.ubicacionNombre ?? "—"}</div>
                                  {p.ubicacionCode && (
                                    <div className="text-xs text-slate-500 font-mono">{p.ubicacionCode}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{p.puestoNombre ?? "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs">{p.noRol ?? "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{p.zona ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {employee.lastImportBatch && (
              <p className="text-xs text-slate-500">
                Última importación: {employee.lastImportBatch.filename} (
                {formatDate(employee.lastImportBatch.createdAt)})
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
