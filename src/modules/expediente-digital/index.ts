export type {
  ExpedienteCandidato,
  ExpedienteDocumento,
  ExpedienteEmpleo,
  ExpedientePersona,
  ExpedienteTipoDoc,
  ExpedienteUploadResult,
} from "./business/types";

export {
  downloadExpedienteDocumento,
  getExpedientePersona,
  isExpedienteSmbConfigured,
  listTiposDocumento,
  searchExpedientePersonas,
  uploadExpedienteDocumento,
} from "./services/person-dossier";
