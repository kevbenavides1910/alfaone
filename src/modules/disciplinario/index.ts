/**
 * API pública del módulo disciplinario.
 * Preferir imports concretos desde business/ o services/ en código nuevo.
 */

export * from "./business/disciplinary";
export { normalizeZoneCatalogKey } from "./business/disciplinary-zone-key";
export { pickPuntoOmitidoFromRow } from "./business/disciplinary-punto-omitido";

export {
  DuplicateImportError,
  importDisciplinaryWorkbook,
} from "./services/disciplinary-import";
export {
  ensureDisciplinarySettingsRow,
  allocateNextApercibimientoNumero,
  DISCIPLINARY_MAIL_PROVIDERS,
  DEFAULT_DOCUMENT_INTRO_TEMPLATE,
  renderMailTemplate,
} from "./services/disciplinary-settings";
