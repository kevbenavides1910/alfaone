import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { nafEmployeeSourceKey } from "@/modules/empleados-naf/business/employee-key";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import { syncNafRoleContracts } from "@/modules/empleados-naf/services/sync-role-contracts";

const NAF_EMPLOYEES_QUERY = `
SELECT
  p.NO_CIA,
  p.NO_EMPLE,
  p.NOMBRE_PILA,
  p.APE_PAT,
  p.APE_MAT,
  p.NOMBRE,
  p.ESTADO,
  p.F_INGRESO,
  p.F_EGRESO,
  COALESCE(d.CEDULA, e.CEDULA) AS CEDULA,
  COALESCE(d.CORREO_ELECTRONICO, e.CORREO_ELECTRONICO, e.CORREO) AS CORREO_ELECTRONICO,
  d.DESCRIPCION_PUESTO,
  d.DESCRIPCION_AREA,
  d.DESCRIPCION_DEPA,
  COALESCE(d.NUM_CUENTA, m.NUM_CUENTA, e.NUM_CUENTA) AS NUM_CUENTA,
  d.BANCO,
  e.TIPO_EMP,
  e.TELEFONO,
  COALESCE(m.FORMA_PAGO, e.FORMA_PAGO) AS FORMA_PAGO,
  COALESCE(m.ID_CTA, e.TIPO_CTA) AS TIPO_CTA,
  e.AREA,
  e.DEPTO,
  e.PUESTO,
  e.SEXO,
  e.CATEGORIA,
  e.GRUPO AS CLASE,
  e.IND_OFICIAL,
  e.SAL_BAS,
  e.CONTRATO,
  (
    SELECT MAX(cp.NO_ROL) KEEP (DENSE_RANK FIRST ORDER BY cp.F_INICIO DESC)
    FROM NAF5.AROPCP cp
    WHERE cp.NO_CIA = p.NO_CIA AND cp.NO_EMPLE = p.NO_EMPLE
  ) AS NO_ROL,
  (
    SELECT MAX(COALESCE(NULLIF(TRIM(cp.NO_CONTRATO), ''), mr.NO_CONTRATO)) KEEP (DENSE_RANK FIRST ORDER BY cp.F_INICIO DESC)
    FROM NAF5.AROPCP cp
    LEFT JOIN NAF5.AROPMR mr ON mr.NO_ROL = cp.NO_ROL AND mr.NO_CONTRATO IS NOT NULL AND mr.ESTADO = 'A'
    WHERE cp.NO_CIA = p.NO_CIA AND cp.NO_EMPLE = p.NO_EMPLE
  ) AS CONTRATO_ROL,
  e.DIRECCION,
  e.CORREO,
  e.F_NACIMI,
  e.E_CIVIL,
  e.JORNADA,
  e.NACION,
  e.NO_UBICACION,
  e.ASEGU,
  e.TITULO,
  COALESCE(ub1.DESCRIPCION, ub2.DESCRIPCION) AS NOMBRE_UBICACION,
  vz.DESC_ZONA AS ZONA_VIOP,
  COALESCE(vuz.NO_ZONA, ub1.NO_ZONA, ub2.NO_ZONA) AS NO_ZONA,
  cpv.ZONA AS ZONA_CPV,
  OPOBTIENE_ZONA_OPERACIONES(
    p.NO_CIA,
    COALESCE(cp_rol.NO_UBICACION, e.NO_UBICACION)
  ) AS ZONA_FN,
  rs.ZONA AS ZONA_STREAM,
  tit.DESCRIPCION AS NOMBRE_TITULO,
  ma.COD_PLA,
  vn.DESCRI_NOMINA
FROM NAF5.PVEMPLEADOS p
LEFT JOIN NAF5.VDATOS_EMPLEADO d
  ON d.NO_CIA = p.NO_CIA AND d.NO_EMPLE = p.NO_EMPLE
LEFT JOIN NAF5.EMPLEADOS_NEW e
  ON e.NO_CIA = p.NO_CIA AND e.NO_EMPLE = p.NO_EMPLE
LEFT JOIN NAF5.ARPLME m
  ON m.NO_CIA = p.NO_CIA AND m.NO_EMPLE = p.NO_EMPLE
LEFT JOIN NAF5.ARCOUB ub1
  ON ub1.NO_CIA = e.NO_CIA AND ub1.NO_UBICACION = e.NO_UBICACION
LEFT JOIN NAF5.ARCOUB ub2
  ON ub2.NO_UBICACION = e.NO_UBICACION AND ub1.NO_CIA IS NULL
LEFT JOIN NAF5.VIOPUBICACION_ZONA vuz
  ON vuz.NO_UBICACION = e.NO_UBICACION
LEFT JOIN NAF5.VIOPZONAS vz
  ON vz.NO_ZONA = vuz.NO_ZONA
LEFT JOIN NAF5.CONTROS_PAS_V cpv
  ON cpv.NO_EMPLE = p.NO_EMPLE AND cpv.NO_CIA = p.NO_CIA
LEFT JOIN (
  SELECT NO_CIA, NO_EMPLE,
    MAX(NO_UBICACION) KEEP (DENSE_RANK FIRST ORDER BY F_INICIO DESC) AS NO_UBICACION
  FROM NAF5.AROPCP
  WHERE (F_FIN IS NULL OR F_FIN >= SYSDATE) AND NO_UBICACION IS NOT NULL
  GROUP BY NO_CIA, NO_EMPLE
) cp_rol ON cp_rol.NO_CIA = p.NO_CIA AND cp_rol.NO_EMPLE = p.NO_EMPLE
LEFT JOIN (
  SELECT EMPLEADO_MAESTRO,
    MAX(ZONA) KEEP (DENSE_RANK FIRST ORDER BY EMPLEADO_MAESTRO) AS ZONA
  FROM NAF5.REPORTE_STREAM_EVALUACIONES
  WHERE ZONA IS NOT NULL
  GROUP BY EMPLEADO_MAESTRO
) rs ON rs.EMPLEADO_MAESTRO = p.NO_EMPLE
LEFT JOIN NAF5.ARPLMAEN ma
  ON ma.NO_CIA = p.NO_CIA AND ma.NO_EMPLE = p.NO_EMPLE
LEFT JOIN (
  SELECT NO_CIA, COD_PLA, MAX(DESCRI_NOMINA) AS DESCRI_NOMINA
  FROM NAF5.V_APRL_NOMINAS
  GROUP BY NO_CIA, COD_PLA
) vn ON vn.NO_CIA = ma.NO_CIA AND vn.COD_PLA = ma.COD_PLA
LEFT JOIN NAF5.ARPLTIT tit ON tit.TITULO = e.TITULO
`;

type OracleRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function asDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function asDecimal(value: unknown): Prisma.Decimal | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? new Prisma.Decimal(n) : null;
}

function serializePayload(row: OracleRow): Prisma.InputJsonValue {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (value != null && typeof value === "object" && "toString" in value) {
      out[key] = String(value);
    } else {
      out[key] = value;
    }
  }
  return out as Prisma.InputJsonValue;
}

function resolveRrhhZona(row: OracleRow): string | null {
  const cpv = asString(row.ZONA_CPV);
  if (cpv) return cpv;
  const fn = asString(row.ZONA_FN);
  if (fn && fn !== "Puestos en desuso") return fn;
  return asString(row.ZONA_STREAM);
}

function mapRow(row: OracleRow) {
  const noCia = asString(row.NO_CIA);
  const noEmple = asString(row.NO_EMPLE);
  if (!noCia || !noEmple) {
    throw new Error("Fila NAF sin NO_CIA o NO_EMPLE");
  }
  return {
    sourceKey: nafEmployeeSourceKey(noCia, noEmple),
    noCia,
    noEmple,
    nombre: asString(row.NOMBRE),
    nombrePila: asString(row.NOMBRE_PILA),
    apePat: asString(row.APE_PAT),
    apeMat: asString(row.APE_MAT),
    estado: asString(row.ESTADO),
    cedula: asString(row.CEDULA),
    telefono: asString(row.TELEFONO),
    correoElectronico: asString(row.CORREO_ELECTRONICO) ?? asString(row.CORREO),
    area: asString(row.DESCRIPCION_AREA) ?? asString(row.AREA),
    depto: asString(row.DESCRIPCION_DEPA) ?? asString(row.DEPTO),
    puesto: asString(row.DESCRIPCION_PUESTO) ?? asString(row.PUESTO),
    sexo: asString(row.SEXO),
    formaPago: asString(row.FORMA_PAGO),
    numCuenta: asString(row.NUM_CUENTA),
    tipoCuenta: asString(row.TIPO_CTA),
    banco: asString(row.BANCO),
    tipoEmp: asString(row.TIPO_EMP),
    contrato: asString(row.CONTRATO_ROL) ?? asString(row.CONTRATO),
    ubicacionCode: asString(row.NO_UBICACION),
    ubicacionNombre: asString(row.NOMBRE_UBICACION),
    zonaCode: asString(row.NO_ZONA),
    zona: resolveRrhhZona(row),
    asegu: asString(row.ASEGU),
    noRol: asString(row.NO_ROL),
    tituloCode: asString(row.TITULO),
    tituloNombre: asString(row.NOMBRE_TITULO),
    clase: asString(row.CLASE),
    categoria: asString(row.CATEGORIA),
    nominaCode: asString(row.COD_PLA),
    nominaNombre: asString(row.DESCRI_NOMINA),
    indOficial: asString(row.IND_OFICIAL),
    fIngreso: asDate(row.F_INGRESO),
    fEgreso: asDate(row.F_EGRESO),
    fNacimi: asDate(row.F_NACIMI),
    direccion: asString(row.DIRECCION),
    eCivil: asString(row.E_CIVIL),
    jornada: asString(row.JORNADA),
    nacion: asString(row.NACION),
    salBas: asDecimal(row.SAL_BAS),
    payload: serializePayload(row),
    syncedAt: new Date(),
  };
}

export type NafSyncResult = {
  runId: string;
  rowsFetched: number;
  rowsUpserted: number;
  finishedAt: Date;
};

export async function syncNafEmployees(options?: { triggeredBy?: string }): Promise<NafSyncResult> {
  const run = await prisma.nafEmployeeSyncRun.create({
    data: { status: "running", triggeredBy: options?.triggeredBy ?? "system" },
  });

  try {
    const rows = await withNafOracleConnection(async (conn) => {
      const result = await conn.execute<OracleRow>(NAF_EMPLOYEES_QUERY);
      return result.rows ?? [];
    });

    let rowsUpserted = 0;
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await prisma.$transaction(
        batch.map((row) => {
          const mapped = mapRow(row);
          return prisma.nafEmployee.upsert({
            where: { sourceKey: mapped.sourceKey },
            create: mapped,
            update: mapped,
          });
        }),
      );
      rowsUpserted += batch.length;
    }

    const finishedAt = new Date();
    await syncNafRoleContracts().catch(() => undefined);

    await prisma.nafEmployeeSyncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt,
        rowsFetched: rows.length,
        rowsUpserted,
      },
    });

    return {
      runId: run.id,
      rowsFetched: rows.length,
      rowsUpserted,
      finishedAt,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.nafEmployeeSyncRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    throw e;
  }
}

export async function getLatestNafSyncRun() {
  return prisma.nafEmployeeSyncRun.findFirst({
    orderBy: { startedAt: "desc" },
  });
}
