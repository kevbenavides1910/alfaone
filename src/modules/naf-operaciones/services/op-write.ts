import oracledb from "oracledb";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import { asString } from "@/modules/naf-operaciones/services/oracle-helpers";

export type UpsertOpRolInput = {
  noCiaGrupo: string;
  noContrato: string;
  noUbicacion: string;
  noRol: number;
  semanaPgr: number;
  diaSemana: string;
  inicio?: Date | null;
  fin?: Date | null;
  tipoJornada?: string | null;
  horas?: number | null;
  estado?: string | null;
  perfil?: string | null;
  semanasPgr?: number | null;
  usuario: string;
};

export type AsignarEmpleadoRolInput = {
  noCia: string;
  noEmple: string;
  noRol: number;
  noContrato?: string | null;
  noUbicacion?: string | null;
  tipo?: string | null;
  fInicio?: Date | null;
  fFin?: Date | null;
  usuario: string;
};

export type ReasignarRolInput = {
  noRol: number;
  noCiaNuevo: string;
  noEmpleNuevo: string;
  noContrato?: string | null;
  noUbicacion?: string | null;
  tipo?: string | null;
  usuario: string;
};

export type MarcaAsistenciaInput = {
  noCiaGrupo: string;
  noRol: number;
  diaSemana: string;
  ano: number;
  semana: number;
  marca: "S" | "N";
  horas?: string | null;
  observacion?: string | null;
  usuario: string;
};

export class OpWriteNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpWriteNotAvailableError";
  }
}

function wrapOracleWriteError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (/ORA-01031|ORA-00942|ORA-06550|PCK_ALFA_OP|does not exist/i.test(msg)) {
    throw new OpWriteNotAvailableError(
      "Escritura OP no disponible: despliegue NAF5.PCK_ALFA_OP y GRANT EXECUTE a ALFA_ONE (scripts/oracle/pck_alfa_op.sql).",
    );
  }
  throw e instanceof Error ? e : new Error(msg);
}

async function callProc(
  sql: string,
  binds: oracledb.BindParameters,
): Promise<string | null> {
  try {
    return await withNafOracleConnection(async (conn) => {
      const result = await conn.execute(
        sql,
        {
          ...binds,
          p_msg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
        },
        { autoCommit: true },
      );
      const out = result.outBinds as { p_msg?: string } | undefined;
      return asString(out?.p_msg);
    });
  } catch (e) {
    wrapOracleWriteError(e);
  }
}

export async function upsertOpRol(input: UpsertOpRolInput): Promise<{ message: string | null }> {
  const message = await callProc(
    `BEGIN NAF5.PCK_ALFA_OP.UPSERT_ROL(
       :p_cia, :p_cto, :p_ubi, :p_rol, :p_spgr, :p_dia,
       :p_inicio, :p_fin, :p_tj, :p_horas, :p_est, :p_perfil, :p_spgrs, :p_usr, :p_msg
     ); END;`,
    {
      p_cia: input.noCiaGrupo,
      p_cto: input.noContrato,
      p_ubi: input.noUbicacion,
      p_rol: input.noRol,
      p_spgr: input.semanaPgr,
      p_dia: input.diaSemana,
      p_inicio: input.inicio ?? null,
      p_fin: input.fin ?? null,
      p_tj: input.tipoJornada ?? "N",
      p_horas: input.horas ?? null,
      p_est: input.estado ?? "A",
      p_perfil: input.perfil ?? null,
      p_spgrs: input.semanasPgr ?? 1,
      p_usr: input.usuario.slice(0, 30),
    },
  );
  return { message };
}

export async function asignarEmpleadoRol(
  input: AsignarEmpleadoRolInput,
): Promise<{ message: string | null }> {
  const message = await callProc(
    `BEGIN NAF5.PCK_ALFA_OP.ASIGNAR_EMPLEADO_ROL(
       :p_cia, :p_emp, :p_rol, :p_cto, :p_ubi, :p_tipo, :p_fi, :p_ff, :p_usr, :p_msg
     ); END;`,
    {
      p_cia: input.noCia,
      p_emp: input.noEmple,
      p_rol: input.noRol,
      p_cto: input.noContrato ?? null,
      p_ubi: input.noUbicacion ?? null,
      p_tipo: input.tipo ?? "N",
      p_fi: input.fInicio ?? new Date(),
      p_ff: input.fFin ?? null,
      p_usr: input.usuario.slice(0, 30),
    },
  );
  return { message };
}

export async function reasignarRol(
  input: ReasignarRolInput,
): Promise<{ message: string | null }> {
  const message = await callProc(
    `BEGIN NAF5.PCK_ALFA_OP.REASIGNAR_ROL(
       :p_rol, :p_cia, :p_emp, :p_cto, :p_ubi, :p_tipo, :p_usr, :p_msg
     ); END;`,
    {
      p_rol: input.noRol,
      p_cia: input.noCiaNuevo,
      p_emp: input.noEmpleNuevo,
      p_cto: input.noContrato ?? null,
      p_ubi: input.noUbicacion ?? null,
      p_tipo: input.tipo ?? "N",
      p_usr: input.usuario.slice(0, 30),
    },
  );
  return { message };
}

export async function marcaAsistencia(
  input: MarcaAsistenciaInput,
): Promise<{ message: string | null }> {
  const message = await callProc(
    `BEGIN NAF5.PCK_ALFA_OP.MARCA_ASISTENCIA(
       :p_cia, :p_rol, :p_dia, :p_ano, :p_sem, :p_marca, :p_horas, :p_obs, :p_usr, :p_msg
     ); END;`,
    {
      p_cia: input.noCiaGrupo,
      p_rol: input.noRol,
      p_dia: input.diaSemana,
      p_ano: input.ano,
      p_sem: input.semana,
      p_marca: input.marca,
      p_horas: input.horas ?? null,
      p_obs: input.observacion ?? null,
      p_usr: input.usuario.slice(0, 30),
    },
  );
  return { message };
}

export async function nextNoRol(): Promise<number> {
  return withNafOracleConnection(async (conn) => {
    const result = await conn.execute<{ NEXT_ROL?: number }>(
      `SELECT NAF5.PCK_ALFA_OP.NEXT_NO_ROL AS NEXT_ROL FROM DUAL`,
    );
    const rows = result.rows ?? [];
    const n = Number(rows[0]?.NEXT_ROL);
    if (!Number.isFinite(n) || n <= 0) {
      throw new OpWriteNotAvailableError("No se pudo obtener siguiente NO_ROL");
    }
    return n;
  });
}
