/**
 * Mapa Oracle Forms OP → tablas NAF5 (Fase 0).
 *
 * | Pantalla Forms        | Tabla / vista principal                         |
 * |-----------------------|-------------------------------------------------|
 * | ROLES / PROGRAMACION  | AROPMR (plantilla rol×día×semana_pgr)           |
 * | ASIGNACION propietario| AROPPR.PROPIETARIO (semana calendario)         |
 * | Historial vínculo     | AROPCP (empleado↔rol; en prod suele venir cerrado)|
 * | MARCA / pago día      | AROPPR (PROPIETARIO, marcas, salario/extras)    |
 * | Sustitutos            | AROPSR                                          |
 * | Calendario semanal    | AROPCA (ANO, SEMANA, FECHA1/2, INDICADOR)       |
 * | Compañía grupo OP     | AROPMC (NO_CIA_GRUPO)                           |
 *
 * Claves:
 * - AROPMR PK: NO_CIA_GRUPO, NO_CONTRATO, NO_UBICACION, NO_ROL, SEMANA_PGR, DIA_SEMANA
 * - AROPPR PK: NO_CIA_GRUPO, NO_ROL, DIA_SEMANA, ANO, SEMANA
 * - SEMANA_PGR ≠ semana calendario; ciclo de rotación del rol (0..SEMANAS_PGR)
 * - ESTADO AROPMR: A activo, I inactivo, P pendiente
 * - DIA_SEMANA: '1'..'7'
 * - AROPCP.TIPO: N / E / S (asignación normal / especial / …)
 *
 * Privilegio ALFA_ONE hoy: SELECT (vía SELECT ANY TABLE). Escritura requiere
 * package NAF5.PCK_ALFA_OP — ver scripts/oracle/pck_alfa_op.sql
 */

export const OP_ORACLE_TABLES = [
  "NAF5.AROPMR",
  "NAF5.AROPCP",
  "NAF5.AROPPR",
  "NAF5.AROPSR",
  "NAF5.AROPCA",
  "NAF5.AROPMC",
  "NAF5.ARPLME",
  "NAF5.ARCOUB",
] as const;

export const OP_DBA_CHECKLIST = [
  "Crear package NAF5.PCK_ALFA_OP (scripts/oracle/pck_alfa_op.sql)",
  "GRANT EXECUTE ON NAF5.PCK_ALFA_OP TO ALFA_ONE",
  "Opcional: synonym público PCK_ALFA_OP",
  "Validar UPSERT_ROL / ASIGNAR_EMPLEADO_ROL / REASIGNAR_ROL en semana real",
  "Confirmar auditoría USUARIO_INGRESA / FECHA_INGRESA en AROPMR/AROPCP",
] as const;
