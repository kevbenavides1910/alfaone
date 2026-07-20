/** Semántica Forms OP / NAF5.AROP* */

/** Estado de plantilla de rol en AROPMR. */
export type OpRoleEstado = "A" | "I" | "P" | string;

/**
 * SEMANA_PGR: slot dentro del ciclo de programación del rol (0..N),
 * no confundir con la semana calendario (AROPPR.ANO/SEMANA / AROPCA).
 */
export type OpRoleRow = {
  noCiaGrupo: string;
  noRol: number;
  diaSemana: string;
  noContrato: string;
  noUbicacion: string;
  semanaPgr: number;
  semanasPgr: number | null;
  estado: string | null;
  tipoJornada: string | null;
  horas: number | null;
  inicio: string | null;
  fin: string | null;
  perfil: string | null;
  noPuesto: string | null;
  tipoRol: string | null;
  administrativo: string | null;
  temporada: string | null;
  /** Asignación vigente (AROPCP), si hay. */
  noCia: string | null;
  noEmple: string | null;
  tipoAsig: string | null;
  nombreEmpleado: string | null;
  ubicacionNombre: string | null;
};

export type OpAssignmentRow = {
  noCia: string | null;
  noEmple: string | null;
  noRol: number;
  fInicio: string | null;
  fFin: string | null;
  tipo: string | null;
  monto: number | null;
  completo: string | null;
  noUbicacion: string | null;
  noContrato: string | null;
  cedula: string | null;
  nombreEmpleado: string | null;
  estadoEmpleado: string | null;
};

export type OpAsistenciaRow = {
  noCiaGrupo: string;
  noRol: number;
  diaSemana: string;
  ano: number;
  semana: number;
  dia: string | null;
  propietario: string | null;
  nombrePropietario: string | null;
  indEstado: string | null;
  indLaboral: string | null;
  indMarca: string | null;
  estadoRol: string | null;
  horas: string | null;
  salario: number | null;
  extras: number | null;
  feriado: number | null;
  observacion: string | null;
  indInconsistencia: string | null;
  noContrato: string | null;
  noUbicacion: string | null;
};

export type OpVacanteRow = {
  noCiaGrupo: string;
  noRol: number;
  diaSemana: string;
  noContrato: string;
  noUbicacion: string;
  semanaPgr: number;
  estado: string | null;
  tipoJornada: string | null;
  horas: number | null;
  inicio: string | null;
  fin: string | null;
  perfil: string | null;
  ubicacionNombre: string | null;
};

export type OpCalendarWeek = {
  ano: number;
  semana: number;
  fecha1: string | null;
  fecha2: string | null;
  indicador: string | null;
  mes: number | null;
};

export type OpListMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export const OP_DIA_SEMANA_LABELS: Record<string, string> = {
  "1": "Lunes",
  "2": "Martes",
  "3": "Miércoles",
  "4": "Jueves",
  "5": "Viernes",
  "6": "Sábado",
  "7": "Domingo",
};

export const OP_ESTADO_LABELS: Record<string, string> = {
  A: "Activo",
  I: "Inactivo",
  P: "Pendiente",
};
