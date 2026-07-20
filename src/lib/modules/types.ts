/** Identificadores estables de dominio de negocio en la plataforma Alfa One. */
export type AppModuleId =
  | "core"
  | "presupuestos"
  | "ventas"
  | "facturacion"
  | "facturacionElectronica"
  | "reportes"
  | "inventario"
  | "disciplinario"
  | "empleados"
  | "empleadosNaf"
  | "nafOperaciones"
  | "sig"
  | "recorridos"
  | "ticketsTi"
  | "formularios"
  | "bandeco"
  | "expedienteDigital"
  | "plataforma";

export type AppModuleMeta = {
  id: AppModuleId;
  label: string;
  description: string;
  /** Rutas UI (App Router) que pertenecen al módulo. */
  uiRoutePrefixes: string[];
  /** Prefijos de API Route Handlers. */
  apiRoutePrefixes: string[];
  /** Carpetas de código donde vive la lógica hoy (Fase 2 → migrar a src/modules). */
  codePaths: string[];
  /** Modelos Prisma del dominio (referencia; no exhaustivo en presupuestos). */
  prismaModels: string[];
};
