export type AttDriveMapping = {
  letter: string;
  uncPath: string;
  label: string;
};

/** Unidades de red típicas en estaciones Alfa One (como Attendance Management). */
export const DEFAULT_ATT_DRIVE_MAPPINGS: AttDriveMapping[] = [
  {
    letter: "X",
    uncPath: "//10.1.1.3/DB-Biometrico",
    label: "DB-Biometrico (\\\\10.1.1.3) (X:)",
  },
  {
    letter: "W",
    uncPath: "//10.1.1.3/Depto TI",
    label: "Depto TI (\\\\10.1.1.3) (W:)",
  },
  {
    letter: "I",
    uncPath: "//10.1.1.3/ZKTeco Alajuela",
    label: "ZKTeco Alajuela (\\\\10.1.1.3) (I:)",
  },
  {
    letter: "U",
    uncPath: "//10.1.1.3/Radiocomunicacion Data",
    label: "Radiocomunicacion Data (\\\\10.1.1.3) (U:)",
  },
  {
    letter: "V",
    uncPath: "//10.1.1.3/Contabilidad",
    label: "Contabilidad (\\\\10.1.1.3) (V:)",
  },
  {
    letter: "Z",
    uncPath: "//10.1.1.3/Proyectos Alfatronic",
    label: "Proyectos Alfatronic (\\\\10.1.1.3) (Z:)",
  },
];

export type ResolvedAttPath = {
  windowsPath: string;
  smbShare: string;
  databaseName: string;
  driveLetter: string | null;
};

function normalizeMappings(input: AttDriveMapping[] | null | undefined): AttDriveMapping[] {
  const custom = Array.isArray(input) ? input : [];
  const byLetter = new Map<string, AttDriveMapping>();
  for (const m of DEFAULT_ATT_DRIVE_MAPPINGS) byLetter.set(m.letter.toUpperCase(), m);
  for (const m of custom) {
    if (m.letter && m.uncPath) byLetter.set(m.letter.toUpperCase(), m);
  }
  return [...byLetter.values()].sort((a, b) => a.letter.localeCompare(b.letter));
}

export function getAttDriveMappings(stored: unknown): AttDriveMapping[] {
  if (!stored || !Array.isArray(stored)) return DEFAULT_ATT_DRIVE_MAPPINGS;
  return normalizeMappings(stored as AttDriveMapping[]);
}

/** Valida y normaliza mapeos editados desde la UI (letra A–Z → //servidor/carpeta). */
export function normalizeAttDriveMappings(input: unknown): AttDriveMapping[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("Agregue al menos un mapeo de unidad de red.");
  }

  const result: AttDriveMapping[] = [];
  const seen = new Set<string>();

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<AttDriveMapping>;
    const letter = String(item.letter ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z]$/.test(letter)) {
      throw new Error(`Letra de unidad inválida: "${item.letter ?? ""}". Use A–Z.`);
    }
    if (seen.has(letter)) {
      throw new Error(`La unidad ${letter}: está duplicada.`);
    }
    seen.add(letter);

    let uncPath = String(item.uncPath ?? "").trim();
    if (/^\\\\[^\\]+\\[^\\]+/.test(uncPath)) {
      const m = uncPath.match(/^\\\\([^\\]+)\\(.+)$/);
      if (m) uncPath = `//${m[1]}/${m[2].replace(/\\/g, "/")}`;
    } else {
      uncPath = uncPath.replace(/\\/g, "/");
    }
    if (!/^\/\/[^/\s]+\/[^/\s]+/.test(uncPath)) {
      throw new Error(
        `Ruta inválida para ${letter}:. Use //servidor/carpeta o \\\\servidor\\carpeta.`,
      );
    }

    const label =
      String(item.label ?? "").trim() ||
      `${uncPath.split("/").pop()} (\\\\${uncPath.slice(2).replace("/", "\\")}) (${letter}:)`;

    result.push({ letter, uncPath, label });
  }

  return result.sort((a, b) => a.letter.localeCompare(b.letter));
}

/** Convierte X:\\ATT2016.MDB o \\\\servidor\\share\\archivo.mdb a share SMB + archivo. */
export function resolveAttDatabasePath(
  input: string,
  mappingsInput?: unknown,
): ResolvedAttPath {
  const mappings = getAttDriveMappings(mappingsInput);
  const trimmed = input.trim().replace(/\//g, "\\");

  if (!trimmed) {
    throw new Error("Indique la ruta de la base de datos (ej. X:\\ATT2016.MDB).");
  }

  const uncFull = trimmed.match(/^\\\\([^\\]+)\\([^\\]+)\\([^\\]+\.(mdb|accdb))$/i);
  if (uncFull) {
    const [, host, share, file] = uncFull;
    return {
      windowsPath: trimmed,
      smbShare: `//${host}/${share}`,
      databaseName: file!,
      driveLetter: null,
    };
  }

  const driveMatch = trimmed.match(/^([A-Za-z]):\\([^\\]+\.(mdb|accdb))$/i);
  if (driveMatch) {
    const letter = driveMatch[1]!.toUpperCase();
    const file = driveMatch[2]!;
    const map = mappings.find((m) => m.letter.toUpperCase() === letter);
    if (!map) {
      throw new Error(
        `La unidad ${letter}: no está configurada. Agregue el mapeo de red o use ruta UNC (\\\\servidor\\carpeta\\archivo.mdb).`,
      );
    }
    return {
      windowsPath: `${letter}:\\${file}`,
      smbShare: map.uncPath,
      databaseName: file,
      driveLetter: letter,
    };
  }

  throw new Error(
    "Ruta no reconocida. Use formato de unidad de red (X:\\ATT2016.MDB) o UNC (\\\\10.1.1.3\\DB-Biometrico\\ATT2016.MDB).",
  );
}

export function buildWindowsPathFromParts(params: {
  driveLetter?: string | null;
  databaseName: string;
  smbShare?: string | null;
}): string {
  const file = params.databaseName.trim();
  if (params.driveLetter) {
    return `${params.driveLetter.toUpperCase()}:\\${file}`;
  }
  if (params.smbShare) {
    const m = params.smbShare.match(/^\/\/([^/]+)\/(.+)$/);
    if (m) return `\\\\${m[1]}\\${m[2]}\\${file}`;
  }
  return file;
}
