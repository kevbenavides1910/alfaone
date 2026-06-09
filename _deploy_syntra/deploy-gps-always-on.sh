#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/home/soporte-ti/presupuestos-alfa}"
ADMIN="$ROOT/src/modules/syntra/services/patrol-admin-service.ts"

python3 <<PY
from pathlib import Path
p = Path("$ADMIN")
text = p.read_text(encoding="utf-8")
old = """export async function ensureSyntraSettingsRow() {
  return prisma.appSyntraSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}"""
new = """export async function ensureSyntraSettingsRow() {
  const row = await prisma.appSyntraSettings.upsert({
    where: { id: "default" },
    create: { id: "default", enableGpsTrack: true },
    update: { enableGpsTrack: true },
  });
  return { ...row, enableGpsTrack: true };
}"""
if old not in text:
    raise SystemExit("ensureSyntraSettingsRow block not found")
p.write_text(text.replace(old, new), encoding="utf-8")
print("patrol-admin-service patched")
PY

docker compose -f "$ROOT/docker-compose.yml" exec -T postgres psql -U postgres -d security_contracts \
  -c "UPDATE app_syntra_settings SET \"enableGpsTrack\" = true WHERE id = 'default';"

cd "$ROOT"
docker compose up -d --build
echo "GPS always-on server deploy done."
