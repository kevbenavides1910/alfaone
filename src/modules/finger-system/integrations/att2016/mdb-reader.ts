import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Papa from "papaparse";

const execFileAsync = promisify(execFile);

const MDB_DOCKER_IMAGE = process.env.FINGER_MDB_DOCKER_IMAGE?.trim() || "debian:bookworm-slim";

function parseCsvRows(csv: string): Record<string, string>[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error("No fue posible leer datos de la base biométrica.");
  }
  return parsed.data;
}

async function runInMdbDocker(
  localMdbPath: string,
  inner: string,
  readOnly = true,
): Promise<string> {
  const dir = localMdbPath.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
  const file = localMdbPath.replace(/\\/g, "/").split("/").pop()!;
  const mount = readOnly ? `${dir}:/data:ro` : `${dir}:/data`;
  const script = `apt-get update -qq && apt-get install -y -qq mdbtools >/dev/null && ${inner.replace(/\$MDB/g, `/data/${file}`)}`;

  const { stdout } = await execFileAsync(
    "docker",
    ["run", "--rm", "-v", mount, MDB_DOCKER_IMAGE, "bash", "-lc", script],
    { timeout: 300_000, maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout;
}

export async function mdbExportTable(localMdbPath: string, table: string): Promise<Record<string, string>[]> {
  const csv = await runInMdbDocker(
    localMdbPath,
    `mdb-export -D "|" $MDB ${table}`,
  );
  return parseCsvRows(csv);
}

export async function mdbCountTable(localMdbPath: string, table: string): Promise<number> {
  const out = await runInMdbDocker(localMdbPath, `mdb-count $MDB ${table}`);
  const n = Number.parseInt(out.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

export async function mdbListTables(localMdbPath: string): Promise<string[]> {
  const out = await runInMdbDocker(localMdbPath, `mdb-tables -1 $MDB`);
  return out
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Exporta CHECKINOUT filtrado por rango de fechas (inclusive inicio, exclusivo fin+1 día). */
export async function mdbExportCheckInOutRange(
  localMdbPath: string,
  from: Date,
  to: Date,
): Promise<Record<string, string>[]> {
  const fromStr = formatAccessDate(from);
  const toExclusive = new Date(to);
  toExclusive.setDate(toExclusive.getDate() + 1);
  const toStr = formatAccessDate(toExclusive);

  const csv = await runInMdbDocker(
    localMdbPath,
    `mdb-sql -H -d'|' -P $MDB <<'EOF'
SELECT USERID, CHECKTIME, CHECKTYPE, VERIFYCODE, SENSORID, WorkCode, sn
FROM CHECKINOUT
WHERE CHECKTIME >= #${fromStr}# AND CHECKTIME < #${toStr}#;
EOF`,
  );

  const lines = csv
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("Row") && l !== "USERID|CHECKTIME|CHECKTYPE|VERIFYCODE|SENSORID|WorkCode|sn");

  if (lines.length === 0) return [];

  const header = "USERID|CHECKTIME|CHECKTYPE|VERIFYCODE|SENSORID|WorkCode|sn";
  return parseCsvRows([header, ...lines].join("\n"));
}

/** Resumen de huellas en TEMPLATE (solo metadatos USERID/FINGERID, sin blobs). */
export async function mdbExportTemplateMeta(localMdbPath: string): Promise<{ attUserId: number; fingerId: number }[]> {
  const out = await runInMdbDocker(
    localMdbPath,
    `mdb-sql -H -d'|' -P $MDB <<'EOF'
SELECT USERID, FINGERID FROM TEMPLATE;
EOF`,
  );

  const lines = out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("Row") && l !== "USERID|FINGERID");

  const rows: { attUserId: number; fingerId: number }[] = [];
  for (const line of lines) {
    const [userIdRaw, fingerRaw] = line.split("|");
    const attUserId = Number.parseInt(userIdRaw ?? "", 10);
    const fingerId = Number.parseInt(fingerRaw ?? "", 10);
    if (Number.isFinite(attUserId) && Number.isFinite(fingerId)) {
      rows.push({ attUserId, fingerId });
    }
  }
  return rows;
}

function escapeAccessString(value: string): string {
  return value.replace(/'/g, "''");
}

/** Ejecuta SQL de escritura sobre la copia local MDB (montaje RW). */
export async function mdbSqlExec(localMdbPath: string, sql: string): Promise<void> {
  await runInMdbDocker(
    localMdbPath,
    `mdb-sql $MDB <<'EOF'\n${sql}\nEOF`,
    false,
  ).catch(() => {
    throw new Error("No fue posible ejecutar la operación en la base biométrica.");
  });
}

/** Obtiene MAX(USERID) de USERINFO. */
export async function mdbMaxUserId(localMdbPath: string): Promise<number> {
  const out = await runInMdbDocker(
    localMdbPath,
    `mdb-sql -H -P $MDB <<'EOF'
SELECT MAX(USERID) AS maxid FROM USERINFO;
EOF`,
  );
  const line = out
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("Row") && l !== "maxid");
  const n = Number.parseInt(line ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

/** Verifica si un Badgenumber ya existe en USERINFO. */
export async function mdbFindUserByBadge(
  localMdbPath: string,
  badgeNumber: string,
): Promise<{ attUserId: number; name: string | null } | null> {
  const badge = escapeAccessString(badgeNumber);
  const out = await runInMdbDocker(
    localMdbPath,
    `mdb-sql -H -d'|' -P $MDB <<'EOF'
SELECT USERID, Name FROM USERINFO WHERE Badgenumber='${badge}';
EOF`,
  );
  const line = out
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("Row") && l !== "USERID|Name");
  if (!line) return null;
  const [userIdRaw, name] = line.split("|");
  const attUserId = Number.parseInt(userIdRaw ?? "", 10);
  if (!Number.isFinite(attUserId)) return null;
  return { attUserId, name: name?.trim() || null };
}

export async function mdbInsertUserInfo(
  localMdbPath: string,
  params: { attUserId: number; badgeNumber: string; name: string; defaultDeptId?: number },
): Promise<void> {
  const badge = escapeAccessString(params.badgeNumber);
  const name = escapeAccessString(params.name.slice(0, 40));
  const deptId = params.defaultDeptId ?? 1;
  await mdbSqlExec(
    localMdbPath,
    `INSERT INTO USERINFO (USERID, Badgenumber, Name, DEFAULTDEPTID, ATT, INLATE, OUTEARLY, OVERTIME) VALUES (${params.attUserId}, '${badge}', '${name}', ${deptId}, 1, 1, 1, 1);`,
  );
}

export async function mdbUpdateUserInfo(
  localMdbPath: string,
  params: { attUserId: number; badgeNumber?: string; name?: string; attEnabled?: boolean },
): Promise<void> {
  const sets: string[] = [];
  if (params.badgeNumber !== undefined) {
    sets.push(`Badgenumber='${escapeAccessString(params.badgeNumber)}'`);
  }
  if (params.name !== undefined) {
    sets.push(`Name='${escapeAccessString(params.name.slice(0, 40))}'`);
  }
  if (params.attEnabled !== undefined) {
    sets.push(`ATT=${params.attEnabled ? 1 : 0}`);
  }
  if (sets.length === 0) return;
  await mdbSqlExec(localMdbPath, `UPDATE USERINFO SET ${sets.join(", ")} WHERE USERID=${params.attUserId};`);
}

function formatAccessDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseAccessDateTime(raw: string | undefined | null): Date | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}
