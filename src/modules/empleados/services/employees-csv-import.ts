import { createHash } from "crypto";
import type { Employee } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";
import { parseDateCell } from "@/modules/core/import/xlsx-read";
import {
  cellAt,
  parseCsvText,
  pickCsvHeader,
} from "@/modules/core/import/csv-read";
import { normalizeLicitacionNo } from "@/modules/presupuestos/import/expense-rows";
import {
  EMPLOYEE_ESTADO_INACTIVO,
  normalizeCedula,
} from "@/modules/empleados/business/employee-identity";
import {
  buildSapToCompanyMap,
  resolveCompanyFromSapCode,
} from "@/modules/empleados/business/company-sap";
import { normalizeHeaderKey } from "@/modules/core/import/xlsx-read";

export type EmployeeImportResult = {
  batchId: string;
  rowsProcessed: number;
  employeesUpserted: number;
  employeesCreated: number;
  employeesUpdated: number;
  employeesDeactivated: number;
  placementsUpserted: number;
  rowsSkipped: number;
  errors: { row: number; message: string }[];
};

function parseBoolSn(v: string | null): boolean {
  if (!v) return false;
  const s = v.trim().toUpperCase();
  return s === "S" || s === "SI" || s === "Y" || s === "1" || s === "TRUE";
}

function parseDateOrNull(v: string | null): Date | null {
  if (!v) return null;
  const ymd = parseDateCell(v);
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function normalizeContrato(v: string | null): string | null {
  if (!v) return null;
  const n = normalizeLicitacionNo(v);
  return n || null;
}

type EmployeeRowData = {
  codigoEmpleado: string;
  codigoEmpleadoRaw: string | null;
  cedula: string | null;
  cedulaNormalizada: string | null;
  nombre: string | null;
  aseguradora: string | null;
  email: string | null;
  telefono: string | null;
  fechaNacimiento: Date | null;
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
  fechaIngreso: Date | null;
  centroCosto: string | null;
  categoria: string | null;
  zona: string | null;
  companySapCode: string | null;
  company: string | null;
  lastImportBatchId: string;
  lastSourceFilename: string;
};

async function findEmployeeByIdentity(
  cedulaNorm: string | null,
  codigo: string,
): Promise<Employee | null> {
  if (cedulaNorm) {
    const byCedula = await prisma.employee.findFirst({
      where: { cedulaNormalizada: cedulaNorm },
    });
    if (byCedula) return byCedula;
  }
  return prisma.employee.findUnique({ where: { codigoEmpleado: codigo } });
}

async function upsertEmployeeFromImport(
  existing: Employee | null,
  data: EmployeeRowData,
): Promise<{ employee: Employee; created: boolean }> {
  if (!existing) {
    const employee = await prisma.employee.create({
      data,
    });
    return { employee, created: true };
  }

  let codigoEmpleado = existing.codigoEmpleado;
  if (data.codigoEmpleado !== existing.codigoEmpleado) {
    const codigoTaken = await prisma.employee.findUnique({
      where: { codigoEmpleado: data.codigoEmpleado },
      select: { id: true },
    });
    if (codigoTaken && codigoTaken.id !== existing.id) {
      throw new Error(
        `La cédula ya está registrada pero el código ${data.codigoEmpleado} pertenece a otro empleado`,
      );
    }
    codigoEmpleado = data.codigoEmpleado;
  }

  const employee = await prisma.employee.update({
    where: { id: existing.id },
    data: {
      codigoEmpleado,
      codigoEmpleadoRaw: data.codigoEmpleadoRaw,
      cedula: data.cedula,
      cedulaNormalizada: data.cedulaNormalizada,
      nombre: data.nombre,
      aseguradora: data.aseguradora,
      email: data.email,
      telefono: data.telefono,
      fechaNacimiento: data.fechaNacimiento,
      direccion: data.direccion,
      sexo: data.sexo,
      oficial: data.oficial,
      estado: data.estado ?? "A",
      formaPago: data.formaPago,
      tipoCuenta: data.tipoCuenta,
      numeroCuenta: data.numeroCuenta,
      tituloCode: data.tituloCode,
      tituloNombre: data.tituloNombre,
      clase: data.clase,
      nominaCode: data.nominaCode,
      nominaNombre: data.nominaNombre,
      fechaIngreso: data.fechaIngreso,
      centroCosto: data.centroCosto,
      categoria: data.categoria,
      zona: data.zona,
      companySapCode: data.companySapCode,
      company: data.company,
      lastImportBatchId: data.lastImportBatchId,
      lastSourceFilename: data.lastSourceFilename,
    },
  });
  return { employee, created: false };
}

/**
 * Importa reporte RRHH como sincronización maestra:
 * - Cruce por cédula normalizada (fallback: código de empleado).
 * - Actualiza datos existentes; crea registros nuevos.
 * - Empleados que no vienen en el archivo pasan a estado inactivo (I).
 */
export async function importEmployeesCsv(
  text: string,
  filename: string,
  uploadedById: string,
): Promise<EmployeeImportResult> {
  const parsed = parseCsvText(text);
  if ("error" in parsed) {
    return emptyResult({ row: 1, message: parsed.error });
  }

  const { headers, rows, headerCells } = parsed;

  let idxCompany = pickCsvHeader(headers, "Compañía", "Compania", "Company", "Empresa");
  if (idxCompany === undefined && headerCells.length > 0) {
    const firstKey = normalizeHeaderKey(headerCells[0] ?? "");
    if (firstKey.startsWith("compa")) idxCompany = 0;
  }
  const idxContrato = pickCsvHeader(headers, "Contrato");
  const idxUbicacion = pickCsvHeader(headers, "Ubicacion", "Ubicación");
  const idxUbicacionNombre = pickCsvHeader(headers, "Nombre Ubicacion", "Nombre Ubicación");
  const idxPuesto = pickCsvHeader(headers, "Nombre Puesto", "Puesto");
  const idxCodigo = pickCsvHeader(headers, "Empleado", "Código", "Codigo", "Codigo Empleado");
  const idxNombre = pickCsvHeader(headers, "Nombre", "Nombre Completo");
  const idxCedula = pickCsvHeader(headers, "Cedula", "Cédula", "Identificacion", "Identificación");
  const idxAsegu = pickCsvHeader(headers, "Asegu", "Aseguradora");
  const idxNoRol = pickCsvHeader(headers, "No Rol", "No. Rol", "Rol");
  const idxFormaPago = pickCsvHeader(headers, "Forma Pago");
  const idxTipoCuenta = pickCsvHeader(headers, "Tipo Cuenta");
  const idxNumeroCuenta = pickCsvHeader(headers, "Numero Cuenta", "Número Cuenta", "Cuenta Bancaria");
  const idxTitulo = pickCsvHeader(headers, "Titulo", "Título");
  const idxTituloNombre = pickCsvHeader(headers, "Nombre Titulo", "Nombre Título");
  const idxClase = pickCsvHeader(headers, "Clase");
  const idxNomina = pickCsvHeader(headers, "Nomina", "Nómina");
  const idxNominaNombre = pickCsvHeader(headers, "Nombre Nomina", "Nombre Nómina");
  const idxFechaIngreso = pickCsvHeader(headers, "Fecha Ingreso");
  const idxEmail = pickCsvHeader(headers, "Correo Electronico", "Correo Electrónico", "Email", "Correo");
  const idxTelefono = pickCsvHeader(headers, "Telefono", "Teléfono", "Celular");
  const idxFNac = pickCsvHeader(headers, "F Nacimi", "Fecha Nacimiento", "F. Nacimiento");
  const idxDireccion = pickCsvHeader(headers, "Direccion", "Dirección");
  const idxSexo = pickCsvHeader(headers, "Sexo");
  const idxOficial = pickCsvHeader(headers, "Oficial");
  const idxEstado = pickCsvHeader(headers, "Estado");
  const idxCentroCosto = pickCsvHeader(headers, "Centro Costo");
  const idxCategoria = pickCsvHeader(headers, "Categoria", "Categoría");
  const idxZona = pickCsvHeader(headers, "Zona");

  if (idxCodigo === undefined) {
    return emptyResult({
      row: 1,
      message: 'No se encontró columna "Empleado" (código). Revise los encabezados del CSV.',
    });
  }

  const checksum = createHash("sha256").update(text).digest("hex");

  const priorBatch = await prisma.employeeImportBatch.findUnique({
    where: { checksum },
    select: { id: true },
  });
  if (priorBatch) {
    await prisma.employeeImportBatch.update({
      where: { id: priorBatch.id },
      data: { checksum: null },
    });
  }

  const contracts = await prisma.contract.findMany({
    where: { deletedAt: null },
    select: { id: true, licitacionNo: true },
  });
  const contractIdByLicitacion = new Map<string, string>();
  for (const c of contracts) {
    const key = normalizeLicitacionNo(c.licitacionNo);
    contractIdByLicitacion.set(key, c.id);
    contractIdByLicitacion.set(c.licitacionNo.trim(), c.id);
  }

  const links = await prisma.employeeContractLink.findMany({
    select: { contratoRrhh: true, contractId: true },
  });
  const linkByRrhh = new Map(links.map((l) => [l.contratoRrhh, l.contractId]));

  const catalogCompanies = await prisma.company.findMany({
    select: { code: true, sapCode: true },
  });
  const sapToCompany = buildSapToCompanyMap(catalogCompanies);

  const batch = await prisma.employeeImportBatch.create({
    data: {
      filename: filename.slice(0, 255),
      checksum,
      uploadedById,
    },
  });

  await backfillCedulaNormalizada();

  const errors: EmployeeImportResult["errors"] = [];
  const activeEmployeeIds = new Set<string>();
  let employeesUpserted = 0;
  let employeesCreated = 0;
  let employeesUpdated = 0;
  let placementsUpserted = 0;
  let rowsSkipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const cells = rows[i];
    const codigoRaw = cellAt(cells, idxCodigo) ?? "";
    const codigo = normalizeEmployeeCode(codigoRaw);
    const cedulaRaw = cellAt(cells, idxCedula);
    const cedulaNorm = normalizeCedula(cedulaRaw);

    if (!codigo) {
      const allEmpty = cells.every((c) => !String(c).trim());
      if (allEmpty) continue;
      errors.push({ row: rowNum, message: "Código de empleado vacío o inválido" });
      rowsSkipped++;
      continue;
    }

    if (!cedulaNorm) {
      errors.push({
        row: rowNum,
        message: `Empleado ${codigo}: cédula vacía o inválida (se requiere para sincronizar)`,
      });
      rowsSkipped++;
      continue;
    }

    const contratoRaw = cellAt(cells, idxContrato);
    const contratoNorm = normalizeContrato(contratoRaw) ?? "";
    const ubicacionCode = cellAt(cells, idxUbicacion) ?? "";
    const noRol = cellAt(cells, idxNoRol) ?? "";
    const companyRaw = cellAt(cells, idxCompany);
    const { sapCode: companySapCode, companyCode: company } = resolveCompanyFromSapCode(
      companyRaw,
      sapToCompany,
    );

    if (companyRaw && !companySapCode) {
      errors.push({
        row: rowNum,
        message: `Empleado ${codigo}: código de compañía inválido («${companyRaw}»)`,
      });
      rowsSkipped++;
      continue;
    }

    if (companySapCode && !company) {
      errors.push({
        row: rowNum,
        message: `Empleado ${codigo}: código planilla ${companySapCode} sin empresa en catálogo (configure sapCode en Mantenimiento → Empresas)`,
      });
    }

    const employeeData: EmployeeRowData = {
      codigoEmpleado: codigo,
      codigoEmpleadoRaw: codigoRaw || null,
      cedula: cedulaRaw,
      cedulaNormalizada: cedulaNorm,
      nombre: cellAt(cells, idxNombre),
      aseguradora: cellAt(cells, idxAsegu),
      email: cellAt(cells, idxEmail),
      telefono: cellAt(cells, idxTelefono),
      fechaNacimiento: parseDateOrNull(cellAt(cells, idxFNac)),
      direccion: cellAt(cells, idxDireccion),
      sexo: cellAt(cells, idxSexo),
      oficial: parseBoolSn(cellAt(cells, idxOficial)),
      estado: cellAt(cells, idxEstado) ?? "A",
      formaPago: cellAt(cells, idxFormaPago),
      tipoCuenta: cellAt(cells, idxTipoCuenta),
      numeroCuenta: cellAt(cells, idxNumeroCuenta),
      tituloCode: cellAt(cells, idxTitulo),
      tituloNombre: cellAt(cells, idxTituloNombre),
      clase: cellAt(cells, idxClase),
      nominaCode: cellAt(cells, idxNomina),
      nominaNombre: cellAt(cells, idxNominaNombre),
      fechaIngreso: parseDateOrNull(cellAt(cells, idxFechaIngreso)),
      centroCosto: cellAt(cells, idxCentroCosto),
      categoria: cellAt(cells, idxCategoria),
      zona: cellAt(cells, idxZona),
      companySapCode,
      company,
      lastImportBatchId: batch.id,
      lastSourceFilename: filename.slice(0, 200),
    };

    const placementData = {
      companySapCode,
      company,
      contrato: contratoRaw,
      contratoNormalizado: contratoNorm || null,
      contractId: contratoNorm
        ? linkByRrhh.get(contratoNorm) ?? contractIdByLicitacion.get(contratoNorm) ?? null
        : null,
      ubicacionCode: ubicacionCode || null,
      ubicacionNombre: cellAt(cells, idxUbicacionNombre),
      puestoNombre: cellAt(cells, idxPuesto),
      noRol: noRol || null,
      zona: cellAt(cells, idxZona),
      importBatchId: batch.id,
    };

    try {
      const existing = await findEmployeeByIdentity(cedulaNorm, codigo);
      const { employee, created } = await upsertEmployeeFromImport(existing, employeeData);
      activeEmployeeIds.add(employee.id);
      employeesUpserted++;
      if (created) employeesCreated++;
      else employeesUpdated++;

      await prisma.employeePlacement.upsert({
        where: {
          employeeId_contratoNormalizado_ubicacionCode_noRol: {
            employeeId: employee.id,
            contratoNormalizado: contratoNorm,
            ubicacionCode: ubicacionCode,
            noRol: noRol,
          },
        },
        create: {
          employeeId: employee.id,
          ...placementData,
        },
        update: placementData,
      });
      placementsUpserted++;
    } catch (e) {
      errors.push({
        row: rowNum,
        message: e instanceof Error ? e.message : "Error al guardar fila",
      });
      rowsSkipped++;
    }
  }

  const activeIds = [...activeEmployeeIds];
  const deactivated =
    activeIds.length > 0
      ? await prisma.employee.updateMany({
          where: {
            id: { notIn: activeIds },
            NOT: { estado: EMPLOYEE_ESTADO_INACTIVO },
          },
          data: { estado: EMPLOYEE_ESTADO_INACTIVO },
        })
      : { count: 0 };

  await prisma.employeeImportBatch.update({
    where: { id: batch.id },
    data: {
      rowsProcessed: rows.length,
      employeesUpserted,
      placementsUpserted,
      rowsSkipped,
      employeesDeactivated: deactivated.count,
      errorsJson: errors.length ? errors : undefined,
    },
  });

  return {
    batchId: batch.id,
    rowsProcessed: rows.length,
    employeesUpserted,
    employeesCreated,
    employeesUpdated,
    employeesDeactivated: deactivated.count,
    placementsUpserted,
    rowsSkipped,
    errors,
  };
}

function emptyResult(error: { row: number; message: string }): EmployeeImportResult {
  return {
    batchId: "",
    rowsProcessed: 0,
    employeesUpserted: 0,
    employeesCreated: 0,
    employeesUpdated: 0,
    employeesDeactivated: 0,
    placementsUpserted: 0,
    rowsSkipped: 0,
    errors: [error],
  };
}

/** Rellena cédula normalizada en registros previos a esta funcionalidad. */
async function backfillCedulaNormalizada(): Promise<void> {
  const missing = await prisma.employee.findMany({
    where: { cedula: { not: null }, cedulaNormalizada: null },
    select: { id: true, cedula: true },
    take: 5000,
  });
  for (const row of missing) {
    const norm = normalizeCedula(row.cedula);
    if (!norm) continue;
    await prisma.employee.update({
      where: { id: row.id },
      data: { cedulaNormalizada: norm },
    });
  }
}
