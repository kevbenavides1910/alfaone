export class FeDomainError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code = "FE_DOMAIN_ERROR", statusCode = 400) {
    super(message);
    this.name = "FeDomainError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class FeNotFoundError extends FeDomainError {
  constructor(message: string) {
    super(message, "FE_NOT_FOUND", 404);
    this.name = "FeNotFoundError";
  }
}

export class FeHaciendaError extends FeDomainError {
  constructor(message: string, code = "FE_HACIENDA_ERROR") {
    super(message, code, 422);
    this.name = "FeHaciendaError";
  }
}

/** Comprobante ya existe en Hacienda (400 + x-error-cause). */
export class FeHaciendaDuplicateError extends FeHaciendaError {
  constructor(message: string) {
    super(message, "FE_HACIENDA_DUPLICATE");
    this.name = "FeHaciendaDuplicateError";
  }
}

export class FeNotImplementedError extends FeDomainError {
  constructor(feature: string) {
    super(`${feature} aún no implementado`, "FE_NOT_IMPLEMENTED", 501);
    this.name = "FeNotImplementedError";
  }
}
