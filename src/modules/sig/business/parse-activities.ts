export type ProcedureActivityInput = {
  code: string;
  name: string;
  description: string;
  documents?: string | null;
  responsible?: string | null;
};

/**
 * Parsea la tabla Actividad | Descripción | Documentos | Responsable
 * tolerando celdas partidas por saltos de línea del PDF.
 */
export function parseActivitiesFromText(text: string): ProcedureActivityInput[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  const startIdx = cleaned.search(/descripci[oó]n\s+de\s+actividades/i);
  const start = startIdx >= 0 ? startIdx : 0;
  const endCandidates = [
    cleaned.search(/\n\s*\d+\.?\s*procesos?\s+que\s+interact/i),
    cleaned.search(/\n\s*procesos?\s+que\s+interact/i),
    cleaned.search(/\n\s*\d+\.?\s*control\s+de\s+cambios/i),
    cleaned.search(/\n\s*control\s+de\s+cambios/i),
    cleaned.search(/\n\s*\d+\.?\s*anexos?\b/i),
  ].filter((i) => i > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : cleaned.length;

  let chunk = cleaned.slice(start, end);
  chunk = chunk
    .replace(/^[\s\S]*?descripci[oó]n\s+de\s+actividades\s*/i, "")
    .replace(/Actividad\s+Descripci[oó]n\s+Documentos\s+Responsable/gi, "\n")
    .replace(/PROCEDIMIENTO[\s\S]*?COPIA NO CONTROLADA[\s\S]*?ALFA\.?\s*S\.?A\.?/gi, "\n");

  const lines = chunk
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !/^(Actividad|Descripci[oó]n|Documentos|Responsable)$/i.test(l));

  const activityStart = /^(\d+\.\d+(?:\.\d+)*)\s*(.*)$/;
  type Block = { code: string; nameStart: string; lines: string[] };
  const blocks: Block[] = [];
  let cur: Block | null = null;

  for (const t of lines) {
    const m = t.match(activityStart);
    if (m) {
      if (cur) blocks.push(cur);
      cur = { code: m[1], nameStart: (m[2] || "").trim(), lines: [] };
      continue;
    }
    if (cur) cur.lines.push(t);
  }
  if (cur) blocks.push(cur);

  const FORM_RE =
    /\b(F-[A-Z]{1,4}-\d+|PO-[A-Z]{1,4}-\d+|P-[A-Z]{1,4}-\d+|M-[A-Z]{1,4}-\d+|I-[A-Z]{1,4}-\d+)\b/i;
  const ROLE_RE =
    /\b(Administrador|Auxiliar|Encargado|Director|Financiero|Comercial|Coordinador|Supervisor|Gerente|Colaborador|Jefatura|Contable|Planillas|Cuentas\s*X?\s*Pagar|D\.?\s*ADM)\b/i;
  // Sin /i global: "la solicitud" es título, no prosa.
  const PROSE_START_RE =
    /^(Suministrar|Debe |Los |Las |El |La |En |Realizar|Completa|Todos|Nota:|Verificar|Se |Con |Cuando|Una vez|Al |Para |debe )/;

  function isFormOrNa(s: string): boolean {
    const t = s.trim();
    if (/^(NA|N\/A)$/i.test(t)) return true;
    if (FORM_RE.test(t)) return true;
    if (/^CODISA$/i.test(t)) return true;
    // "Control" solo no es documento (suele ser rol/área); sí con código F-
    if (/^Control\s+F-/i.test(t)) return true;
    return false;
  }

  function isDocTitleContinuation(s: string): boolean {
    const t = s.trim();
    if (isFormOrNa(t)) return true;
    if (
      /^(Solicitud|Asignaci[oó]n|Reporte|Pol[ií]tica|Gastos|Operativo|Vi[aá]ticos|Personal|Transferencias|Fondo|Creaci[oó]n|Cliente)\b/i.test(
        t
      )
    ) {
      return true;
    }
    if (/^(de|del|y|por|para|operativos?|vi[aá]ticos?)\b/i.test(t) && t.length <= 50 && !ROLE_RE.test(t)) {
      return true;
    }
    return false;
  }

  function isRoleLine(s: string): boolean {
    const t = s.trim();
    if (isFormOrNa(t) || FORM_RE.test(t)) return false;
    if (/Operativo\.?$/i.test(t) && !ROLE_RE.test(t)) return false;
    if (/^Vi[aá]ticos\.?$/i.test(t)) return false;
    if (ROLE_RE.test(t)) return true;
    if (/^(de|del|para|por|y|\/)\s/i.test(t) && t.length <= 40 && !/\d{2,}/.test(t)) return true;
    if (/^(Territorio|pagar|cajas|Pagar)$/i.test(t)) return true;
    if (/^Control$/i.test(t)) return true; // a veces aparece como área/rol en la celda
    return false;
  }

  function isNameContinuation(s: string): boolean {
    if (PROSE_START_RE.test(s)) return false;
    if (isFormOrNa(s) || FORM_RE.test(s)) return false;
    if (s.length > 55) return false;
    if (/[.!?]$/.test(s) && s.length > 25) return false;
    return true;
  }

  return blocks.map((b) => {
    const rest = [...b.lines];
    const nameParts: string[] = [];
    if (b.nameStart) nameParts.push(b.nameStart);

    while (rest.length && isNameContinuation(rest[0]) && nameParts.join(" ").length < 140) {
      if (nameParts.length >= 6) break;
      nameParts.push(rest.shift()!);
    }

    const responsibleParts: string[] = [];
    const documentParts: string[] = [];

    while (rest.length && isRoleLine(rest[rest.length - 1]) && responsibleParts.length < 4) {
      responsibleParts.unshift(rest.pop()!);
    }

    while (rest.length && documentParts.length < 8) {
      const last = rest[rest.length - 1];
      // Empezar docs solo con código de formulario / NA / CODISA / Control
      if (documentParts.length === 0) {
        if (isFormOrNa(last)) {
          documentParts.unshift(rest.pop()!);
          continue;
        }
        break;
      }
      // Continuación del nombre del formulario ya iniciado
      if (isDocTitleContinuation(last) && !ROLE_RE.test(last)) {
        documentParts.unshift(rest.pop()!);
        continue;
      }
      break;
    }

    // Caso: uno o más formularios al final del bloque (sin rol después)
    if (!documentParts.length && rest.length) {
      let firstForm = -1;
      for (let i = 0; i < rest.length; i++) {
        if (FORM_RE.test(rest[i]) || /^(NA|N\/A|CODISA)$/i.test(rest[i])) {
          firstForm = i;
          break;
        }
      }
      if (firstForm > 0 && /^Control$/i.test(rest[firstForm - 1])) {
        firstForm -= 1;
      }
      if (firstForm >= 0) {
        documentParts.push(...rest.splice(firstForm));
        // Separar cargo multi-línea pegado después de NA/form (ej. Coordinador de Planillas…)
        let cut = documentParts.length - 1;
        while (
          cut >= 0 &&
          !isFormOrNa(documentParts[cut]) &&
          !FORM_RE.test(documentParts[cut])
        ) {
          cut -= 1;
        }
        const trailing = documentParts.slice(cut + 1);
        if (trailing.some((l) => ROLE_RE.test(l))) {
          responsibleParts.unshift(...documentParts.splice(cut + 1));
        }
      }
    }

    return {
      code: b.code,
      name: (nameParts.join(" ").replace(/\s+/g, " ").trim() || `Actividad ${b.code}`).slice(0, 300),
      description: (rest.join("\n").trim() || "—").slice(0, 50000),
      documents: (() => {
        const d = documentParts.join(" ").replace(/\s+/g, " ").trim();
        return d ? d.slice(0, 4000) : null;
      })(),
      responsible: (() => {
        const r = responsibleParts.join(" ").replace(/\s+/g, " ").trim();
        return r ? r.slice(0, 300) : null;
      })(),
    };
  });
}
