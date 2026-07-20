import {
  expedientePdfCandidates,
  expedientePdfWritePath,
} from "@/modules/expediente-digital/business/paths";
import type {
  ExpedientePersona,
  ExpedienteUploadResult,
} from "@/modules/expediente-digital/business/types";
import {
  getTipoDocumento,
  listDocumentosByCedula,
  listEmpleosByCedula,
  listTiposDocumento,
  pickCanonicalEmpleo,
  resolveOracleCedula,
  searchExpedientePersonas,
  upsertExpedienteMeta,
} from "@/modules/expediente-digital/services/oracle-expediente";
import {
  fetchExpedienteSmbFile,
  findExpedientePdfByPrefix,
  isExpedienteSmbConfigured,
  putExpedienteSmbFile,
} from "@/modules/expediente-digital/services/smb-expediente";

export {
  listTiposDocumento,
  searchExpedientePersonas,
  isExpedienteSmbConfigured,
};

export async function getExpedientePersona(
  cedulaRaw: string,
): Promise<ExpedientePersona | null> {
  const cedula = await resolveOracleCedula(cedulaRaw);
  if (!cedula) return null;

  const empleos = await listEmpleosByCedula(cedula);
  if (!empleos.length) return null;

  const canon = pickCanonicalEmpleo(empleos);
  const documentos = await listDocumentosByCedula(
    cedula,
    empleos.map((e) => e.noEmple),
  );

  const nombre =
    empleos.find((e) => e.estado === "A")?.nombre ||
    empleos[0]?.nombre ||
    "";

  return {
    cedula,
    nombre: nombre ?? "",
    empleos,
    noEmpleCanonico: canon?.noEmple ?? null,
    noCiaCanonica: canon?.noCia ?? null,
    documentos,
  };
}

export async function downloadExpedienteDocumento(params: {
  cedulaRaw: string;
  tipoDoc: string;
  noEmple: string;
  nVersion?: number | null;
}): Promise<{ buf: Buffer; fileName: string } | null> {
  if (!isExpedienteSmbConfigured()) {
    throw new Error(
      "SMB del expediente no configurado (EXPEDIENTE_SMB_PASSWORD o NAF_SMB_PASSWORD)",
    );
  }

  const persona = await getExpedientePersona(params.cedulaRaw);
  if (!persona) return null;

  const allowed = new Set(persona.empleos.map((e) => e.noEmple));
  // Also allow padded variants
  for (const e of persona.empleos) {
    const pad = e.noEmple.replace(/^0+/, "") || e.noEmple;
    allowed.add(pad);
  }
  const neo = params.noEmple.trim();
  const neoPad = neo.replace(/^0+/, "") || neo;
  const owns =
    allowed.has(neo) ||
    allowed.has(neoPad) ||
    Array.from(allowed).some((c) => (c.replace(/^0+/, "") || c) === neoPad);
  if (!owns) return null;

  const tipo = await getTipoDocumento(params.tipoDoc);
  const tipoFolder = tipo?.ruta || params.tipoDoc;

  const candidates = expedientePdfCandidates({
    tipoFolder,
    noEmple: params.noEmple,
    nVersion: params.nVersion,
  });

  for (const remote of candidates) {
    const buf = await fetchExpedienteSmbFile(remote);
    if (buf) {
      return { buf, fileName: remote.split("/").pop() || "documento.pdf" };
    }
  }

  const fallback = await findExpedientePdfByPrefix(
    tipoFolder,
    params.noEmple,
    params.nVersion,
  );
  if (fallback) {
    const buf = await fetchExpedienteSmbFile(fallback);
    if (buf) {
      return { buf, fileName: fallback.split("/").pop() || "documento.pdf" };
    }
  }

  return null;
}

export async function uploadExpedienteDocumento(params: {
  cedulaRaw: string;
  tipoDoc: string;
  fileBuffer: Buffer;
  fileName: string;
  venceDesde?: string | null;
  venceHasta?: string | null;
  actor?: string | null;
  /** Si se omite, usa el empleo canónico (activo + ingreso reciente). */
  noEmple?: string | null;
}): Promise<ExpedienteUploadResult> {
  if (!isExpedienteSmbConfigured()) {
    throw new Error(
      "SMB del expediente no configurado (EXPEDIENTE_SMB_PASSWORD o NAF_SMB_PASSWORD)",
    );
  }

  const persona = await getExpedientePersona(params.cedulaRaw);
  if (!persona) {
    throw new Error("No se encontró personal con esa cédula");
  }

  const tipo = await getTipoDocumento(params.tipoDoc);
  if (!tipo || tipo.estado !== "A") {
    throw new Error(`Tipo de documento inválido o inactivo: ${params.tipoDoc}`);
  }

  let noEmple = params.noEmple?.trim() || persona.noEmpleCanonico;
  if (!noEmple) {
    throw new Error("No hay código de empleado canónico para guardar el archivo");
  }

  const owns = persona.empleos.some((e) => {
    const a = e.noEmple.replace(/^0+/, "") || e.noEmple;
    const b = noEmple!.replace(/^0+/, "") || noEmple!;
    return e.noEmple === noEmple || a === b;
  });
  if (!owns) {
    throw new Error("El código de empleado no pertenece a esta cédula");
  }

  // NAF: VENCE='N' → vigencia indefinida (1900-01-01 / 1900-01-01); columnas NOT NULL.
  const INDEFINIDA = "1900-01-01";
  let venceDesde = params.venceDesde?.trim() || null;
  let venceHasta = params.venceHasta?.trim() || null;
  if (!tipo.vence) {
    venceDesde = INDEFINIDA;
    venceHasta = INDEFINIDA;
  } else if (!venceDesde) {
    throw new Error("Este tipo de documento requiere vigencia desde");
  } else if (!venceHasta) {
    venceHasta = INDEFINIDA;
  }

  const { nVersion } = await upsertExpedienteMeta({
    tipoDoc: tipo.tipoDocumento,
    noEmple,
    cedula: persona.cedula,
    generaVersion: tipo.generaVersion,
    venceDesde,
    venceHasta,
    actor: params.actor,
  });

  const remotePath = expedientePdfWritePath(tipo.ruta || tipo.tipoDocumento, noEmple);
  const ok = await putExpedienteSmbFile(remotePath, params.fileBuffer);
  if (!ok) {
    throw new Error(`No se pudo guardar el archivo en el share: ${remotePath}`);
  }

  return {
    tipoDoc: tipo.tipoDocumento,
    noEmple,
    nVersion,
    remotePath,
    cedula: persona.cedula,
  };
}
