/** Tipos para consulta de vacaciones de personal (ARPLVAC / ARPLAP). */

export type VacacionesCandidato = {
  cedula: string;
  nombre: string;
  noEmplePreferido: string | null;
  noCiaPreferida: string | null;
  fechaIngreso: string | null;
  estado: string | null;
  empleosCount: number;
};

export type VacacionesPeriodo = {
  periodo: number;
  diasGanados: number;
  diasDisfrutados: number;
  diasIncapacidad: number;
  saldo: number;
};

export type VacacionesEmpleo = {
  noCia: string;
  noEmple: string;
  nombre: string | null;
  fIngreso: string | null;
  fEgreso: string | null;
  estado: string | null;
};

export type VacacionesBaja = {
  noCia: string;
  noEmple: string;
  fInicio: string | null;
};

/** Movimiento individual (disfrute de vacaciones o incapacidad). */
export type VacacionesMovimientoDetalle = {
  noCia: string;
  noEmple: string;
  /** Número de acción de personal (ARPLAP.NO_ACCION). */
  noAccion: string | null;
  /** Número de transacción en libro de vacaciones (ARPLVAC.NO_ACCION), si aplica. */
  noTransaccion: string | null;
  tipoA: string | null;
  fInicio: string | null;
  fConclu: string | null;
  dias: number;
  periodo: number | null;
  detalle: string | null;
};

export type VacacionesConsulta = {
  cedula: string;
  nombre: string;
  fechaIngreso: string | null;
  /** Empleo NAF usado para el libro de vacaciones (12 días/año). */
  empleoVacaciones: { noCia: string; noEmple: string } | null;
  /** Última acción 011 (corta historial). Null si no hay bajas. */
  ultimaBaja011: string | null;
  notaSegmento: string;
  empleos: VacacionesEmpleo[];
  periodos: VacacionesPeriodo[];
  totales: {
    diasGanados: number;
    diasDisfrutados: number;
    saldo: number;
    diasIncapacidad: number;
    incapacidadAcciones: number;
  };
  bajasHistoricas: VacacionesBaja[];
  detalleDisfrutados: VacacionesMovimientoDetalle[];
  detalleIncapacidades: VacacionesMovimientoDetalle[];
};
