"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldHelp, LabelWithHelp, ValidationBanner } from "@/components/ui/field-help";
import type { UseMutationResult } from "@tanstack/react-query";
import { FeCatalogSearchPicker } from "@/components/facturacion-electronica/FeCatalogSearchPicker";
import { FeUbicacionCrSelects } from "@/components/facturacion-electronica/FeUbicacionCrSelects";
import { feApiUrl } from "@/components/facturacion-electronica/fe-company-context";
import { type nuevoClienteDefault, validateId, validateEmail, validateActividadEconomica, validateCliente, ID_RANGES } from "./fe-nueva-types";
import { Textarea } from "@/components/ui/textarea";
import type { FeContribuyenteLookup } from "@/modules/facturacion-electronica/services/hacienda/contribuyente-lookup.service";
import { actividadDescripcion } from "@/modules/facturacion-electronica/utils/fe-contribuyente-cliente-map";

interface FeNuevoClienteSectionProps {
  nuevoCliente: typeof nuevoClienteDefault;
  setNuevoCliente: React.Dispatch<React.SetStateAction<typeof nuevoClienteDefault>>;
  nuevoClienteActividadDesc: string;
  setNuevoClienteActividadDesc: (v: string) => void;
  haciendaClienteInfo: FeContribuyenteLookup | null;
  setHaciendaClienteInfo: (v: FeContribuyenteLookup | null) => void;
  setClienteLookupHint: (v: string | null) => void;
  clienteLookupLoading: boolean;
  clienteLookupHint: string | null;
  clienteErrors: string[];
  clienteId: string;
  companyCode: string | null;
  exigirUbicacion: boolean;
  tipoDocumento: string;
  guardarClienteM: UseMutationResult<any, Error, void, unknown>;
}

export function FeNuevoClienteSection({
  nuevoCliente,
  setNuevoCliente,
  nuevoClienteActividadDesc,
  setNuevoClienteActividadDesc,
  haciendaClienteInfo,
  setHaciendaClienteInfo,
  setClienteLookupHint,
  clienteLookupLoading,
  clienteLookupHint,
  clienteErrors,
  clienteId,
  companyCode,
  exigirUbicacion,
  tipoDocumento,
  guardarClienteM,
}: FeNuevoClienteSectionProps) {
  return (
              <div className="mt-2 grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <LabelWithHelp className="text-xs" required help="Tipo de identificación del receptor según Hacienda. Física: 9 dígitos, Jurídica: 10, DIMEX: 11-12, NITE: 10, Extranjero: 9-20.">
                    Tipo ID
                  </LabelWithHelp>
                  <Select
                    value={nuevoCliente.tipoIdentificacion}
                    onValueChange={(v) => setNuevoCliente((c) => ({ ...c, tipoIdentificacion: v }))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FISICA">Física — 9 dígitos</SelectItem>
                      <SelectItem value="JURIDICA">Jurídica — 10 dígitos</SelectItem>
                      <SelectItem value="DIMEX">DIMEX — 11-12 dígitos</SelectItem>
                      <SelectItem value="NITE">NITE — 10 dígitos</SelectItem>
                      <SelectItem value="EXTRANJERO">Extranjero — 9-20 dígitos</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldHelp text={ID_RANGES[nuevoCliente.tipoIdentificacion]?.label ?? ""} />
                </div>
                <div className="space-y-1">
                  <LabelWithHelp className="text-xs" required help="Número de cédula o identificación sin guiones. Al completar la longitud correcta se consulta Hacienda para autocompletar el nombre.">
                    {nuevoCliente.tipoIdentificacion === "JURIDICA"
                      ? "Cédula jurídica"
                      : nuevoCliente.tipoIdentificacion === "FISICA"
                        ? "Cédula física"
                        : "Identificación"}
                  </LabelWithHelp>
                  <Input
                    className="h-8"
                    value={nuevoCliente.identificacion}
                    onChange={(e) => {
                      setClienteLookupHint(null);
                      setHaciendaClienteInfo(null);
                      setNuevoCliente((c) => ({ ...c, identificacion: e.target.value.replace(/\D/g, "") }));
                    }}
                    placeholder={nuevoCliente.tipoIdentificacion === "FISICA" ? "001120580" : nuevoCliente.tipoIdentificacion === "JURIDICA" ? "3101598499" : ""}
                  />
                  <FieldHelp
                    error={validateId(nuevoCliente.tipoIdentificacion, nuevoCliente.identificacion)}
                    valid={!validateId(nuevoCliente.tipoIdentificacion, nuevoCliente.identificacion) && nuevoCliente.identificacion.length > 0}
                    text={
                      clienteLookupLoading
                        ? "Consultando Hacienda…"
                        : clienteLookupHint ??
                          `${nuevoCliente.identificacion.replace(/\D/g, "").length} dígitos`
                    }
                  />
                </div>
                {haciendaClienteInfo ? (
                  <div className="sm:col-span-2 rounded-md border border-emerald-200 bg-emerald-50/80 p-2 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
                    <p className="font-medium text-emerald-800 dark:text-emerald-200">Información tributaria (Hacienda)</p>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {haciendaClienteInfo.regimen?.descripcion ? (
                        <li>Régimen: {haciendaClienteInfo.regimen.descripcion}</li>
                      ) : null}
                      {haciendaClienteInfo.situacion?.estado ? (
                        <li>Situación: {haciendaClienteInfo.situacion.estado}</li>
                      ) : null}
                      {haciendaClienteInfo.situacion?.administracionTributaria ? (
                        <li>Administración: {haciendaClienteInfo.situacion.administracionTributaria}</li>
                      ) : null}
                      {(haciendaClienteInfo.situacion?.moroso || haciendaClienteInfo.situacion?.omiso) ? (
                        <li>
                          Moroso: {haciendaClienteInfo.situacion?.moroso ?? "—"} · Omiso:{" "}
                          {haciendaClienteInfo.situacion?.omiso ?? "—"}
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
                <div className="space-y-1 sm:col-span-2">
                  <LabelWithHelp className="text-xs" required help="Nombre o razón social del receptor. Se autocompleta al ingresar la cédula. Máximo 80 caracteres.">
                    Nombre / Razón social
                  </LabelWithHelp>
                  <Input
                    className="h-8"
                    value={nuevoCliente.nombre}
                    onChange={(e) => setNuevoCliente((c) => ({ ...c, nombre: e.target.value }))}
                    maxLength={80}
                  />
                  <FieldHelp
                    text="Como aparece registrado en Hacienda"
                    valid={nuevoCliente.nombre.trim().length > 0}
                    error={!nuevoCliente.nombre.trim() ? "Nombre obligatorio" : null}
                    maxLength={80}
                    currentLength={nuevoCliente.nombre.length}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <LabelWithHelp className="text-xs" help="Correo del cliente donde se enviará automáticamente el XML y PDF del comprobante cuando Hacienda lo acepte. Requerido para envío automático.">
                    Correo (para envío de comprobante)
                  </LabelWithHelp>
                  <Input
                    className="h-8"
                    type="email"
                    value={nuevoCliente.email}
                    onChange={(e) => setNuevoCliente((c) => ({ ...c, email: e.target.value }))}
                    placeholder="cliente@empresa.com"
                  />
                  <FieldHelp
                    error={validateEmail(nuevoCliente.email)}
                    valid={nuevoCliente.email.trim().length > 0 && !validateEmail(nuevoCliente.email)}
                    text="Se envía el comprobante automático al aceptar Hacienda"
                  />
                </div>
                <div className="space-y-1">
                  <LabelWithHelp className="text-xs" help="Teléfono del receptor (8-20 dígitos). Hacienda no lo publica; ingréselo manualmente si lo tiene.">
                    Teléfono
                  </LabelWithHelp>
                  <Input
                    className="h-8"
                    value={nuevoCliente.telefono}
                    onChange={(e) => setNuevoCliente((c) => ({ ...c, telefono: e.target.value.replace(/\D/g, "").slice(0, 20) }))}
                    placeholder="22223333"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <LabelWithHelp className="text-xs" help="Código de actividad económica del receptor según catálogo TRIBU de Hacienda. Puede ingresarse como 6 dígitos (702000) o formato TRIBU (7020.0). Opcional pero recomendado.">
                    Actividad económica (TRIBU)
                  </LabelWithHelp>
                  {companyCode ? (
                    <FeCatalogSearchPicker
                      companyCode={companyCode}
                      kind="actividad"
                      value={nuevoCliente.actividadEconomica}
                      selectedDescription={nuevoClienteActividadDesc}
                      identificacion={nuevoCliente.identificacion}
                      onSelect={(item) => {
                        setNuevoCliente((c) => ({ ...c, actividadEconomica: item.codigo }));
                        setNuevoClienteActividadDesc(item.descripcion);
                      }}
                    />
                  ) : null}
                  <Input
                    className="h-8"
                    value={nuevoCliente.actividadEconomica}
                    placeholder="7020.0 o 702000"
                    onChange={(e) => {
                      setNuevoClienteActividadDesc("");
                      setNuevoCliente((c) => ({ ...c, actividadEconomica: e.target.value }));
                    }}
                  />
                  <FieldHelp
                    error={validateActividadEconomica(nuevoCliente.actividadEconomica)}
                    valid={nuevoCliente.actividadEconomica.trim().length > 0 && !validateActividadEconomica(nuevoCliente.actividadEconomica)}
                    text="Ej. 7020.0 (vigilancia privada) — 6 dígitos o formato TRIBU"
                  />
                  {haciendaClienteInfo && haciendaClienteInfo.actividades.length > 1 ? (
                    <div className="space-y-1 pt-1">
                      <LabelWithHelp className="text-xs" help="Seleccione cuál actividad registrada en Hacienda aplicar al comprobante.">
                        Actividad registrada en Hacienda
                      </LabelWithHelp>
                      <Select
                        value={nuevoCliente.actividadEconomica || undefined}
                        onValueChange={(v) => {
                          const act = haciendaClienteInfo.actividades.find((a) => a.codigo === v);
                          setNuevoCliente((c) => ({ ...c, actividadEconomica: v }));
                          setNuevoClienteActividadDesc(act?.descripcion ?? "");
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Seleccione actividad…" />
                        </SelectTrigger>
                        <SelectContent>
                          {haciendaClienteInfo.actividades.map((a) => (
                            <SelectItem key={a.codigo} value={a.codigo}>
                              {a.codigo} — {a.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
                <FeUbicacionCrSelects
                  compact
                  required={exigirUbicacion && tipoDocumento !== "TIQUETE_ELECTRONICO"}
                  value={{
                    provincia: nuevoCliente.direccionProvincia,
                    canton: nuevoCliente.direccionCanton,
                    distrito: nuevoCliente.direccionDistrito,
                  }}
                  onChange={(next) =>
                    setNuevoCliente((c) => ({
                      ...c,
                      direccionProvincia: next.provincia,
                      direccionCanton: next.canton,
                      direccionDistrito: next.distrito,
                    }))
                  }
                />
                <div className="space-y-1">
                  <LabelWithHelp className="text-xs" help="Nombre del barrio. Opcional. Máximo 50 caracteres.">
                    Barrio
                  </LabelWithHelp>
                  <Input
                    className="h-8"
                    value={nuevoCliente.direccionBarrio}
                    maxLength={50}
                    onChange={(e) => setNuevoCliente((c) => ({ ...c, direccionBarrio: e.target.value }))}
                  />
                  <FieldHelp text="Opcional — máximo 50 caracteres" maxLength={50} currentLength={nuevoCliente.direccionBarrio.length} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <LabelWithHelp className="text-xs" help="Otras señas o referencia de ubicación. Se autocompleta con resumen tributario de Hacienda si no hay dirección exacta.">
                    Otras señas / notas
                  </LabelWithHelp>
                  <Textarea
                    className="min-h-[56px] text-sm"
                    value={nuevoCliente.direccionOtras}
                    maxLength={500}
                    onChange={(e) => setNuevoCliente((c) => ({ ...c, direccionOtras: e.target.value }))}
                  />
                </div>
                {(() => {
                  const errs = validateCliente(nuevoCliente, {
                    exigirUbicacion,
                    esTiquete: tipoDocumento === "TIQUETE_ELECTRONICO",
                  });
                  return errs.length > 0 ? (
                    <div className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/40">
                      <p className="text-xs font-medium text-red-600 mb-1">Corrija antes de guardar:</p>
                      <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
                        {errs.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  ) : null;
                })()}
                <Button
                  type="button"
                  size="sm"
                  className="sm:col-span-2"
                  disabled={
                    guardarClienteM.isPending ||
                    validateCliente(nuevoCliente, {
                      exigirUbicacion,
                      esTiquete: tipoDocumento === "TIQUETE_ELECTRONICO",
                    }).length > 0
                  }
                  onClick={() => guardarClienteM.mutate()}
                >
                  {guardarClienteM.isPending
                    ? "Guardando…"
                    : clienteId
                      ? "Actualizar cliente"
                      : "Guardar cliente"}
                </Button>
              </div>
  );
}
