/**
 * Depura “contratos” Codisa inválidos: placeholders entre empresas del grupo
 * (NO_CONTRATO / NO_LICITACION / CLIENTE = nombre de empresa hermana).
 */

function normLabel(s: string | null | undefined): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[,.]+$/g, "")
    .trim()
    .replace(/\.+$/g, "")
    .trim();
}

/** Códigos / razones sociales del grupo usadas como falso NO_CONTRATO o licitación. */
const OWN_CONTRACT_LABELS = [
  "ALFA",
  "TANGO",
  "MONITOREO",
  "BENA",
  "CONSORCIO",
  "GRUPO",
  "JOBEN",
  "BENLO",
  "ACE",
  "AS",
  "KBA",
  "DESARROLLOS",
  "ALFATRONIC",
  "ALFATRON",
  "ACE S.A",
  "ACE SA",
  "ALFATRONIC S.A",
  "ALFATRONIC SA",
  "ALFA SECURE S.A",
  "ALFA SECURE SA",
  "SEGURIDAD ALFA",
  "SEGURIDAD ALFA S.A",
  "SEGURIDAD ALFA SA",
  "SEGURIDAD TANGO",
  "SEGURIDAD TANGO S.A",
  "SEGURIDAD TANGO SA",
  "CONSORCIO SEGURIDAD ALFA",
  "CONSORCIO SEGURIDAD ALFA S.A",
  "CONSORCIO SEGURIDAD ALFA SA",
  "CONSORCIO DE SEGURIDAD ALFA",
  "CONSORCIO DE SEGURIDAD ALFA S.A",
  "GRUPO CORPARATIVO ALFA",
  "GRUPO CORPORATIVO ALFA",
  "GRUPO CORPORATIVO DE SEGURIDAD ALFA",
  "GRUPO CORP.SEGURIDAD ALFA SA",
  "GRUPO CORPOR.SEGURIDAD ALFA SA",
  "SERVICIO DE MONITOREO",
  "SERVICIO MONITOREO",
  "SERVICIO MONITOREO ELECTRONICO",
  "SERVICIO MONITOREO ELECTRON",
  "SERVICIO MONITOREO ELECTRON SA",
  "SERVICIO MONITOREO ELECT ALFA",
  "SERVICIO DE MONITOREO ELECTRONICO ALFA",
  "SERVICIOS MULTIPLES BENA",
  "SERVICIOS MULTIPLES BENA S.A",
  "SERVICIOS MULTIPLES BENA SA",
  "SERVICIO CONTROL JOBEN",
  "SERVICIO CONTROL VIGILAN JOBEN",
  "SERVICIO CONTROL VIG. JOBEN SA",
  "SERVICIO CONTROL VIG JOBEN SA",
  "SERVICIOS DE CONTROL Y VIGILANCIA JOBEN",
  "SERVICIO VIGILANCIA BENLO",
  "SERVICIOS VIGI.OPERATIVA BENLO",
  "SERVICIOS VIG.OPERATIVA BENLO",
  "SERVICIOS VIG OPERATIVA BENLO",
  "SERVICIO DE VIGILANCIA OPERATIVA BENLO",
  "SERVICIO VIGILANCIA OPERATIVO BENLO",
  "COMPANIA MONITOREO",
  "COMPANIA GRUPO",
];

const OWN_CONTRACT_SET = new Set(OWN_CONTRACT_LABELS.map(normLabel));

/** Clientes que son empresas del grupo (no clientes externos reales). */
const OWN_CLIENT_PATTERNS: RegExp[] = [
  /^SERVICIOS?\s+MULTIPLES\s+BENA\b/,
  /^SEGURIDAD\s+ALFA\b/,
  /^SEGURIDAD\s+TANGO\b/,
  /^CONSORCIO\s+(DE\s+)?SEGURIDAD\s+ALFA\b/,
  /^GRUPO\s+CORP(ORATIVO|ARATIVO|\.?)\s*(DE\s+)?SEGURIDAD\s+ALFA\b/,
  /^SERVICIO\s+DE\s+MONITOREO\s+ELECTRONICO\s+ALFA\b/,
  /^SERVICIOS?\s+DE\s+CONTROL\s+Y\s+VIGILANCIA\s+JOBEN\b/,
  /^SERVICIO\s+(DE\s+)?VIGILANCIA\s+OPERATIV[AO]\s+BENLO\b/,
  /^SERVICIOS?\s+DE\s+CONTROL\s+Y\s+VIGILANCIA\b$/,
  /^ALFATRONIC(\s+S\.?A\.?)?$/,
  /^ALFA\s+SECURE(\s+S\.?A\.?)?$/,
  /^ACE(\s+S\.?A\.?)?$/,
  /^ASESORIA[S]?\s+Y\s+CAPACITACI(ON|ONES)\s+EMPRESARIAL/,
  /^ACESORIA[S]?\s+Y\s+CAPACITACI(ON|ONES)\s+EMPRESARIAL/,
];

export function isOwnGroupContractLabel(text: string | null | undefined): boolean {
  const t = normLabel(text);
  if (!t) return false;
  // Números de licitación reales no se filtran.
  if (/^\d{4}[A-Z]{2}-/.test(t)) return false;
  if (OWN_CONTRACT_SET.has(t)) return true;
  // ALFA.... / TANGO.. etc.
  const bare = t.replace(/\.+$/g, "").trim();
  if (OWN_CONTRACT_SET.has(bare)) return true;
  // Prefijos conocidos + S.A / SA
  for (const label of OWN_CONTRACT_SET) {
    if (bare === label) return true;
    if (bare.startsWith(label + " S") || bare.startsWith(label + " SA")) return true;
  }
  if (/^SERVICIOS?\b/.test(bare) && /(BENA|JOBEN|BENLO|ALFA|MONITOREO|TANGO|GRUPO|CONSORCIO)/.test(bare)) {
    return true;
  }
  if (/^(SEGURIDAD|CONSORCIO|GRUPO)\b/.test(bare) && /(ALFA|TANGO|BENA|BENLO|JOBEN)/.test(bare)) {
    return true;
  }
  if (/^COMPANIA\s+(MONITOREO|GRUPO|ALFA|TANGO|BENA|JOBEN|BENLO)\b/.test(bare)) return true;
  return false;
}

export function isOwnGroupClient(cliente: string | null | undefined): boolean {
  const t = normLabel(cliente);
  if (!t) return false;
  if (isOwnGroupContractLabel(t)) return true;
  return OWN_CLIENT_PATTERNS.some((re) => re.test(t));
}

/** true = no mostrar (placeholder interno entre empresas del grupo). */
export function isInvalidCodisaGroupPlaceholder(row: {
  NO_CONTRATO?: string | null;
  NO_LICITACION?: string | null;
  CLIENTE?: string | null;
}): boolean {
  return (
    isOwnGroupContractLabel(row.NO_CONTRATO) ||
    isOwnGroupContractLabel(row.NO_LICITACION) ||
    isOwnGroupClient(row.CLIENTE)
  );
}
