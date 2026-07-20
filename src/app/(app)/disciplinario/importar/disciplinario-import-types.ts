// Types and pure utilities for the Disciplinario import page.
export interface ImportResultData {
  batchId: string;
  rowsHistorial: number;
  rowsTratamiento: number;
  apercibimientosInserted: number;
  apercibimientosUpdated: number;
  apercibimientosSkipped: number;
  omisionesInserted: number;
  omisionesDeleted: number;
  treatmentsInserted: number;
  treatmentsUpdated: number;
  treatmentsSkipped: number;
  errors: { sheet: string; row: number; message: string }[];
}

export interface ImportResponse {
  data?: ImportResultData;
  error?: {
    code?: string;
    message: string;
    previousBatch?: {
      id: string;
      filename: string;
      createdAt: string;
      uploadedByName: string | null;
    };
  };
}

export interface DuplicateInfo {
  message: string;
  previousBatch: {
    id: string;
    filename: string;
    createdAt: string;
    uploadedByName: string | null;
  };
}

export interface BatchRow {
  id: string;
  filename: string;
  notes: string | null;
  rowsHistorial: number;
  rowsTratamiento: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkipped: number;
  errorsJson: { sheet: string; row: number; message: string }[] | null;
  createdAt: string;
  uploadedBy: { name: string; email: string };
  _count: { apercibimientos: number };
}

export interface MarcasImportData {
  batchId: string;
  rowsSheet: number;
  apercibimientosInserted: number;
  omisionesInserted: number;
  emailsSent: number;
  emailsSkipped: number;
  emailsSkippedNoEmail?: number;
  errors: { row: number; message: string }[];
}

export interface MarcasPlannedRow {
  codigo: string;
  nombre: string;
  cedula: string | null;
  zona: string | null;
  zonaMaestro: string | null;
  zonaExcel: string | null;
  sucursal: string | null;
  administrador: string | null;
  emailEmpleado: string | null;
  emailCcZona: string | null;
  omisionesCount: number;
  omisionesResumen: string;
  fechaEmision: string;
  numeroPreliminar: string;
  estado: string;
  vigencia: string;
}

export interface MarcasPreviewData {
  checksum: string;
  rowsSheet: number;
  inspeccionMode: boolean;
  planned: MarcasPlannedRow[];
  wouldInsert: number;
  wouldSkipOmisiones: number;
  errors: { row: number; message: string }[];
}

export const ESTADO_MARCAS_LABEL: Record<string, string> = {
  EMITIDO: "Emitido",
  ENTREGADO: "Entregado",
  FIRMADO: "Firmado",
  ANULADO: "Anulado",
};

export const VIGENCIA_MARCAS_LABEL: Record<string, string> = {
  VIGENTE: "Vigente",
  VENCIDO: "Vencido",
  PRESCRITO: "Prescrito",
  FINALIZADO: "Finalizado",
  ANULADO: "Anulado",
};

export interface RetrofillPuntoData {
  batchId: string;
  apercibimientosConCambios: number;
  omisionesActualizadas: number;
  omisionesSinCoincidencia: number;
  avisos: string[];
}

export interface RetrofillFechasData {
  batchId: string;
  omisionesActualizadas: number;
  omisionesSinCambio: number;
  omisionesSinCoincidencia: number;
  apercibimientosConCambios: number;
  cambios: {
    numero: string;
    codigoEmpleado: string;
    omisionesCorregidas: number;
    reenviarCorreo: boolean;
    muestra: { antes: string; despues: string }[];
  }[];
  emailsSent: number;
  emailsSkippedNoEmail: number;
  emailErrors: { codigo: string; message: string }[];
  avisos: string[];
}

export type ApiJsonBody<T> = { data?: T; error?: { message?: string; code?: string; previousBatch?: DuplicateInfo["previousBatch"] } };

export async function parseApiJson<T>(res: Response): Promise<ApiJsonBody<T>> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const snippet = (await res.text()).slice(0, 120).replace(/\s+/g, " ");
    if (snippet.includes("<!DOCTYPE") || snippet.includes("<html")) {
      throw new Error(
        "La operación tardó demasiado o el servidor devolvió una página de error. " +
          "Revise si los correos se enviaron igualmente y use «Enviar correos pendientes» si faltan.",
      );
    }
    throw new Error(`Respuesta inesperada del servidor (${res.status}). ${snippet}`);
  }
  return (await res.json()) as ApiJsonBody<T>;
}

export async function flushPendingMarcasBatchEmails(batchId: string): Promise<{
  emailsSent: number;
  emailsSkipped: number;
  emailsSkippedNoEmail: number;
  errors: { codigo: string; message: string }[];
}> {
  let emailsSent = 0;
  let emailsSkipped = 0;
  let emailsSkippedNoEmail = 0;
  const errors: { codigo: string; message: string }[] = [];
  let guard = 0;

  while (guard++ < 80) {
    const res = await fetch(`/api/disciplinary/import/batches/${batchId}/send-emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ maxEmails: 8 }),
    });
    const json = await parseApiJson<{
      emailsSent: number;
      emailsSkipped: number;
      emailsSkippedNoEmail: number;
      pendingSendable: number;
      done: boolean;
      errors: { codigo: string; message: string }[];
    }>(res);
    if (!res.ok) throw new Error(json.error?.message ?? "No se pudieron enviar los correos");
    if (!json.data) throw new Error("Respuesta inesperada al enviar correos");

    emailsSent += json.data.emailsSent;
    emailsSkipped = json.data.emailsSkipped;
    emailsSkippedNoEmail += json.data.emailsSkippedNoEmail;
    errors.push(...json.data.errors);

    if (json.data.done) break;
    if (json.data.emailsSent === 0) break;
  }

  return { emailsSent, emailsSkipped, emailsSkippedNoEmail, errors };
}

