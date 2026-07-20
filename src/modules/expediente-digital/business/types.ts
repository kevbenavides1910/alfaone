export type ExpedienteCandidato = {
  cedula: string;
  nombre: string;
  noEmplePreferido: string | null;
  noCiaPreferida: string | null;
  estado: string | null;
  empleosCount: number;
};

export type ExpedienteEmpleo = {
  noCia: string;
  noEmple: string;
  nombre: string | null;
  estado: string | null;
  fechaIngreso: string | null;
};

export type ExpedienteTipoDoc = {
  tipoDocumento: string;
  descripcion: string;
  ruta: string;
  vence: boolean;
  estado: string;
  acumulativo: boolean;
  generaVersion: boolean;
};

export type ExpedienteDocumento = {
  tipoDoc: string;
  tipoDescripcion: string;
  noEmple: string;
  nVersion: number;
  cedula: string | null;
  estado: string | null;
  valido: string | null;
  archivo: string | null;
  venceDesde: string | null;
  venceHasta: string | null;
  fechaCreacion: string | null;
  fechaModificacion: string | null;
};

export type ExpedientePersona = {
  cedula: string;
  nombre: string;
  empleos: ExpedienteEmpleo[];
  noEmpleCanonico: string | null;
  noCiaCanonica: string | null;
  documentos: ExpedienteDocumento[];
};

export type ExpedienteUploadResult = {
  tipoDoc: string;
  noEmple: string;
  nVersion: number;
  remotePath: string;
  cedula: string;
};
