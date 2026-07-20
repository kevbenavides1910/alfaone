/** Valores por defecto de cargas sociales NAF (47.74% total). */
export const NAF_CARGAS_SOCIALES_DEFAULTS = [
  { codigo: "SEM", nombre: "Seguro Enfermedad y Maternidad", porcentaje: 9.25, grupo: "SEGURIDAD_SOCIAL" },
  { codigo: "IVM", nombre: "Invalidez, Vejez y Muerte", porcentaje: 5.58, grupo: "SEGURIDAD_SOCIAL" },
  { codigo: "BP", nombre: "Banco Popular", porcentaje: 0.5, grupo: "SEGURIDAD_SOCIAL" },
  { codigo: "INA", nombre: "INA", porcentaje: 1.5, grupo: "SEGURIDAD_SOCIAL" },
  { codigo: "IMAS", nombre: "IMAS", porcentaje: 0.5, grupo: "SEGURIDAD_SOCIAL" },
  { codigo: "ASFA", nombre: "Asignaciones Familiares", porcentaje: 5.0, grupo: "SEGURIDAD_SOCIAL" },
  { codigo: "FC", nombre: "Fondo Capitalización", porcentaje: 1.5, grupo: "SEGURIDAD_SOCIAL" },
  { codigo: "FP", nombre: "Fondo Pensiones", porcentaje: 3.0, grupo: "SEGURIDAD_SOCIAL" },
  { codigo: "AGUINALDO", nombre: "Aguinaldo", porcentaje: 8.33, grupo: "GARANTIAS" },
  { codigo: "CESANTIA", nombre: "Cesantía", porcentaje: 5.33, grupo: "GARANTIAS" },
  { codigo: "POLIZA_INS", nombre: "Póliza INS", porcentaje: 3.09, grupo: "POLIZA" },
  { codigo: "VACACIONES", nombre: "Vacaciones", porcentaje: 4.16, grupo: "GARANTIAS" },
] as const;

export const NAF_CARGAS_SOCIALES_DEFAULT_TOTAL_PCT = NAF_CARGAS_SOCIALES_DEFAULTS.reduce(
  (sum, item) => sum + item.porcentaje,
  0,
);
