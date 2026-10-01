export class LegalDocumentError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "BAD_REQUEST",
  ) {
    super(message);
    this.name = "LegalDocumentError";
  }
}
