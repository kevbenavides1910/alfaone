import type { NafEmployee } from "@prisma/client";
import { formatDate } from "@/lib/utils/format";

/** Columnas alineadas con el reporte Oracle APEX «Empleados y Cuentas Bancarias» + CSV RRHH. */
export type NafEmployeeReportRow = Pick<
  NafEmployee,
  | "noCia"
  | "contrato"
  | "ubicacionCode"
  | "ubicacionNombre"
  | "zona"
  | "puesto"
  | "noEmple"
  | "nombre"
  | "cedula"
  | "asegu"
  | "noRol"
  | "formaPago"
  | "tipoCuenta"
  | "numCuenta"
  | "tituloCode"
  | "tituloNombre"
  | "clase"
  | "categoria"
  | "nominaCode"
  | "nominaNombre"
  | "fIngreso"
  | "fNacimi"
  | "correoElectronico"
  | "telefono"
  | "sexo"
  | "direccion"
  | "indOficial"
  | "banco"
  | "eCivil"
  | "jornada"
  | "nacion"
>;

export const NAF_REPORT_COLUMNS: {
  key: keyof NafEmployeeReportRow;
  label: string;
  format?: (row: NafEmployeeReportRow) => string;
}[] = [
  { key: "noCia", label: "Compañía" },
  { key: "contrato", label: "Contrato" },
  { key: "ubicacionCode", label: "Ubicación" },
  { key: "ubicacionNombre", label: "Nombre ubicación" },
  { key: "zona", label: "Zona" },
  { key: "puesto", label: "Nombre puesto" },
  { key: "noEmple", label: "Empleado" },
  { key: "nombre", label: "Nombre" },
  { key: "cedula", label: "Cédula" },
  { key: "asegu", label: "Asegu" },
  { key: "noRol", label: "No rol" },
  { key: "formaPago", label: "Forma pago" },
  { key: "tipoCuenta", label: "Tipo cuenta" },
  { key: "numCuenta", label: "Número cuenta" },
  { key: "tituloCode", label: "Título" },
  { key: "tituloNombre", label: "Nombre título" },
  { key: "clase", label: "Clase" },
  { key: "categoria", label: "Categoría" },
  { key: "nominaCode", label: "Nómina" },
  { key: "nominaNombre", label: "Nombre nómina" },
  {
    key: "fIngreso",
    label: "Fecha ingreso",
    format: (row) => (row.fIngreso ? formatDate(row.fIngreso) : "—"),
  },
  {
    key: "fNacimi",
    label: "F. nacimiento",
    format: (row) => (row.fNacimi ? formatDate(row.fNacimi) : "—"),
  },
  { key: "correoElectronico", label: "Correo" },
  { key: "telefono", label: "Teléfono" },
  { key: "sexo", label: "Sexo" },
  { key: "direccion", label: "Dirección" },
  { key: "indOficial", label: "Oficial" },
  { key: "eCivil", label: "Estado civil" },
  { key: "jornada", label: "Jornada" },
  { key: "nacion", label: "Nación" },
  { key: "banco", label: "Banco" },
];

export function formatNafReportCell(
  row: NafEmployeeReportRow,
  key: keyof NafEmployeeReportRow,
): string {
  const col = NAF_REPORT_COLUMNS.find((c) => c.key === key);
  if (col?.format) return col.format(row);
  const value = row[key];
  if (value == null || value === "") return "—";
  return String(value);
}

export function nafReportRowToExcel(row: NafEmployeeReportRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of NAF_REPORT_COLUMNS) {
    out[col.label] = formatNafReportCell(row, col.key);
  }
  return out;
}

export const NAF_REPORT_DETAIL_SECTIONS: {
  title: string;
  fields: {
    key: keyof NafEmployeeReportRow | "estado" | "area" | "depto" | "zonaCode";
    label: string;
  }[];
}[] = [
  {
    title: "Identificación y ubicación",
    fields: [
      { key: "noCia", label: "Compañía" },
      { key: "noEmple", label: "Empleado" },
      { key: "nombre", label: "Nombre" },
      { key: "cedula", label: "Cédula" },
      { key: "estado", label: "Estado" },
      { key: "contrato", label: "Contrato" },
      { key: "ubicacionCode", label: "Ubicación" },
      { key: "ubicacionNombre", label: "Nombre ubicación" },
      { key: "zonaCode", label: "Código zona" },
      { key: "zona", label: "Zona" },
      { key: "puesto", label: "Nombre puesto" },
      { key: "area", label: "Área" },
      { key: "depto", label: "Departamento" },
      { key: "noRol", label: "No rol" },
    ],
  },
  {
    title: "Pago y cuenta bancaria",
    fields: [
      { key: "formaPago", label: "Forma pago" },
      { key: "tipoCuenta", label: "Tipo cuenta" },
      { key: "numCuenta", label: "Número cuenta" },
      { key: "banco", label: "Banco" },
      { key: "nominaCode", label: "Nómina" },
      { key: "nominaNombre", label: "Nombre nómina" },
    ],
  },
  {
    title: "Datos personales y contacto",
    fields: [
      { key: "fNacimi", label: "F. nacimiento" },
      { key: "sexo", label: "Sexo" },
      { key: "eCivil", label: "Estado civil" },
      { key: "nacion", label: "Nación" },
      { key: "direccion", label: "Dirección" },
      { key: "correoElectronico", label: "Correo" },
      { key: "telefono", label: "Teléfono" },
      { key: "fIngreso", label: "Fecha ingreso" },
    ],
  },
  {
    title: "Clasificación",
    fields: [
      { key: "tituloCode", label: "Título" },
      { key: "tituloNombre", label: "Nombre título" },
      { key: "clase", label: "Clase" },
      { key: "categoria", label: "Categoría" },
      { key: "asegu", label: "Asegu" },
      { key: "indOficial", label: "Oficial" },
      { key: "jornada", label: "Jornada" },
    ],
  },
];
