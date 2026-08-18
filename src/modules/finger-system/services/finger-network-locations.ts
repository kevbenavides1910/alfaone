import { readFile } from "node:fs/promises";
import {
  getAttDriveMappings,
  type AttDriveMapping,
} from "@/modules/finger-system/integrations/att2016/path-resolver";
import { ensureFingerSettingsRow } from "@/modules/finger-system/services/finger-settings";

export type FingerNetworkLocation = AttDriveMapping & {
  source: "default" | "custom" | "mount";
};

async function detectCifsMounts(): Promise<AttDriveMapping[]> {
  try {
    const mounts = await readFile("/proc/mounts", "utf8");
    const found: AttDriveMapping[] = [];
    let letterCode = 65;

    for (const line of mounts.split("\n")) {
      if (!/ cifs | smbfs | smb3 /i.test(line)) continue;
      const parts = line.split(" ");
      const remote = parts[0]?.replace(/\\040/g, " ");
      const mountPoint = parts[1]?.replace(/\\040/g, " ");
      if (!remote?.startsWith("//") || !mountPoint) continue;

      const letter = String.fromCharCode(letterCode++);
      found.push({
        letter,
        uncPath: remote,
        label: `${mountPoint} (${remote})`,
      });
      if (letterCode > 90) break;
    }
    return found;
  } catch {
    return [];
  }
}

export async function listFingerNetworkLocations(): Promise<{
  locations: FingerNetworkLocation[];
  serverNote: string;
}> {
  const settings = await ensureFingerSettingsRow();
  const saved = getAttDriveMappings(settings.attDriveMappings);
  const hasCustom =
    Array.isArray(settings.attDriveMappings) && settings.attDriveMappings.length > 0;
  const mounts = await detectCifsMounts();

  const locations: FingerNetworkLocation[] = saved.map((m) => ({
    ...m,
    source: hasCustom ? "custom" : "default",
  }));

  for (const m of mounts) {
    if (!locations.some((l) => l.uncPath.toLowerCase() === m.uncPath.toLowerCase())) {
      locations.push({ ...m, source: "mount" });
    }
  }

  return {
    locations: locations.sort((a, b) => a.letter.localeCompare(b.letter)),
    serverNote:
      "Use la unidad de red de su equipo (ej. X:) como en Attendance Management. Finger System traduce esa ruta al share SMB del servidor.",
  };
}
