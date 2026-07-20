/** Rutas remotas del expediente digital NAF (share Expediente Digital). */

export function padNoEmple(noEmple: string): string {
  const trimmed = noEmple.trim();
  if (!trimmed) return trimmed;
  if (/^\d+$/.test(trimmed)) return trimmed.padStart(6, "0");
  return trimmed;
}

export function empleCodeVariants(noEmple: string): string[] {
  const code = padNoEmple(noEmple);
  const raw = noEmple.trim();
  return code === raw ? [code] : [code, raw];
}

/** Carpeta relativa a partir de ARPLTDS.RUTA o TIPO_DOCUMENTO. */
export function expedienteTipoDir(tipoFolder: string): string {
  const normalized = tipoFolder.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) return "EMPLEADOS/UNKNOWN";
  if (/^EMPLEADOS\//i.test(normalized)) return normalized;
  return `EMPLEADOS/${normalized.toUpperCase()}`;
}

export function expedienteTipoDirFromTipoDoc(tipoDoc: string): string {
  return expedienteTipoDir(tipoDoc);
}

/** Candidatos de archivo para descarga (orden de preferencia). */
export function expedientePdfCandidates(params: {
  tipoFolder: string;
  noEmple: string;
  nVersion?: number | null;
}): string[] {
  const dir = expedienteTipoDir(params.tipoFolder);
  const out: string[] = [];

  for (const c of empleCodeVariants(params.noEmple)) {
    const ver = params.nVersion;
    if (ver != null && ver > 1) {
      out.push(`${dir}/${c}_v${ver}.pdf`);
      out.push(`${dir}/${c}_${ver}.pdf`);
      out.push(`${dir}/${c}_${ver}_temp.pdf`);
    } else if (ver === 1) {
      out.push(`${dir}/${c}_1.pdf`);
    }
    out.push(`${dir}/${c}.pdf`);
    out.push(`${dir}/${c}_temp.pdf`);
  }

  return Array.from(new Set(out));
}

/**
 * Elige el mejor PDF cuando NAF usa nombres variables (_temp, _9_temp, etc.).
 */
export function pickBestExpedientePdfFilename(
  filenames: string[],
  noEmple: string,
  nVersion?: number | null,
): string | null {
  const variants = empleCodeVariants(noEmple);
  const matches = filenames.filter(
    (f) => /\.pdf$/i.test(f) && variants.some((v) => f.startsWith(v)),
  );
  if (!matches.length) return null;

  const score = (file: string): number => {
    const lower = file.toLowerCase();
    let s = 0;
    if (!lower.includes("_temp")) s += 100;
    for (const v of variants) {
      const vl = v.toLowerCase();
      if (lower === `${vl}.pdf`) s += 80;
      if (lower === `${vl}_temp.pdf`) s += 60;
    }
    if (nVersion != null && nVersion > 1) {
      const vn = String(nVersion);
      if (lower.includes(`_${vn}_temp.pdf`) || lower.includes(`_${vn}.pdf`)) s += 50;
      if (lower.includes(`_v${vn}.pdf`)) s += 45;
    }
    return s;
  };

  return [...matches].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function expedientePdfWritePath(tipoFolder: string, noEmple: string): string {
  return `${expedienteTipoDir(tipoFolder)}/${padNoEmple(noEmple)}.pdf`;
}
