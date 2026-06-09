/** Normaliza un código SIG (misma lógica que al crear documento). */
export function normalizeSigDocumentCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 80);
}

export type ParsedSigFilename = {
  code: string;
  title: string;
  versionLabel: string;
};

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "").trim();
}

/** Código al inicio del nombre: PO-RH-06, F-RH-30, P-SG-01 */
const CODE_PREFIX_RE = /^([A-Z0-9]+(?:-[A-Z0-9]+)+)\s+(.+)$/i;

/** Separador explícito código — título */
const CODE_DASH_TITLE_RE = /^([A-Z0-9]+(?:-[A-Z0-9._]+)*)\s*[-–—]\s*(.+)$/i;

const CODE_UNDERSCORE_TITLE_RE = /^([A-Z0-9]+(?:-[A-Z0-9._]+)*?)_(.+)$/i;

/** Versión al final: " V1", " V1.2", " Versión 3" */
const VERSION_SUFFIX_RE = /\s+(?:V(?:ersi[oó]n)?\.?\s*)?(\d+(?:\.\d+)?)\s*$/i;

function looksLikeDocumentCode(value: string): boolean {
  const v = value.trim();
  if (v.length < 2 || v.length > 80) return false;
  if (!/^[A-Za-z0-9]/.test(v)) return false;
  if (!/^[A-Za-z0-9._/-]+$/.test(v)) return false;
  return /-/.test(v) || /\d/.test(v);
}

function cleanTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function extractVersion(titlePart: string): { title: string; versionLabel: string } {
  const trimmed = titlePart.trim();
  const match = trimmed.match(VERSION_SUFFIX_RE);
  if (match) {
    return {
      title: cleanTitle(trimmed.slice(0, match.index)),
      versionLabel: match[1],
    };
  }
  return { title: cleanTitle(trimmed), versionLabel: "1" };
}

function result(code: string, titlePart: string): ParsedSigFilename {
  const { title, versionLabel } = extractVersion(titlePart);
  return {
    code: normalizeSigDocumentCode(code),
    title,
    versionLabel,
  };
}

/**
 * Inferir código, título y versión desde el nombre del archivo.
 *
 * Ejemplos:
 * - "PO-RH-06 Código de Vestimenta V1.pdf"
 * - "PO-RH-04 Falsificación y Alteración Documental y Verbal V1.pdf"
 * - "F-RH-30 - Procedimiento de contratación.pdf"
 * - "P-SG-01_Instrucción de trabajo.docx"
 */
export function parseSigFilename(fileName: string): ParsedSigFilename {
  const base = stripExtension(fileName);
  if (!base) {
    return { code: "DOCUMENTO", title: fileName.slice(0, 500), versionLabel: "1" };
  }

  const prefixMatch = base.match(CODE_PREFIX_RE);
  if (prefixMatch) {
    const code = prefixMatch[1].trim();
    const rest = prefixMatch[2].trim();
    if (looksLikeDocumentCode(code) && rest) {
      return result(code, rest);
    }
  }

  const dashMatch = base.match(CODE_DASH_TITLE_RE);
  if (dashMatch) {
    const code = dashMatch[1].trim();
    const rest = dashMatch[2].trim();
    if (looksLikeDocumentCode(code) && rest) {
      return result(code, rest);
    }
  }

  const underscoreMatch = base.match(CODE_UNDERSCORE_TITLE_RE);
  if (underscoreMatch) {
    const code = underscoreMatch[1].trim();
    const rest = underscoreMatch[2].trim();
    if (looksLikeDocumentCode(code) && rest) {
      return result(code, rest);
    }
  }

  if (looksLikeDocumentCode(base)) {
    const { title, versionLabel } = extractVersion(base);
    return {
      code: normalizeSigDocumentCode(base.split(/\s+/)[0] ?? base),
      title,
      versionLabel,
    };
  }

  const firstToken = base.split(/\s+/)[0] ?? "";
  if (looksLikeDocumentCode(firstToken)) {
    return result(firstToken, base.slice(firstToken.length));
  }

  return {
    code: "DOCUMENTO",
    title: cleanTitle(base),
    versionLabel: "1",
  };
}
