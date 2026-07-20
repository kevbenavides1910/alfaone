#!/usr/bin/env bash
# Bloquea deploy si hay un stash con mucha UI distinta al disco.
# Causa (jul-2026): otros agentes despliegan con mejoras en stash@{0};
# este árbol en HEAD viejo pisa Topbar/Shells/home al hacer ops:deploy.
#
# Uso: bash scripts/ops/deploy-ui-stash-guard.sh <ROOT>
# Override: DEPLOY_ALLOW_STASH_UI_DRIFT=1
set -Eeuo pipefail

ROOT="${1:-.}"
ROOT="$(cd "$ROOT" && pwd)"
cd "$ROOT"

if [ "${DEPLOY_ALLOW_STASH_UI_DRIFT:-0}" = "1" ]; then
  echo "WARN: DEPLOY_ALLOW_STASH_UI_DRIFT=1 — se omite guard de UI vs stash"
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "skip: no es repo git"
  exit 0
fi

# Evitar `stash list | head` con pipefail (SIGPIPE → falso “no hay stash”).
if [ -z "$(git stash list -n 1 2>/dev/null || true)" ]; then
  echo "OK: no hay stash — sin drift de UI pendiente"
  exit 0
fi

# Comparar solo fuentes UI relevantes del stash más reciente
mapfile -t FILES < <(git stash show --name-only 'stash@{0}' 2>/dev/null | rg '\.(tsx|ts|css)$' | rg '^(src/app/|src/components/|src/lib/modules/)' || true)
if [ "${#FILES[@]}" -eq 0 ]; then
  echo "OK: stash@{0} sin fuentes UI comparables"
  exit 0
fi

compared=0
differ=0
missing_on_disk=0
samples=()
for f in "${FILES[@]}"; do
  # Solo archivos que realmente existen como blob en el stash (no deletes/renames raros).
  if ! git cat-file -e "stash@{0}:$f" 2>/dev/null; then
    continue
  fi
  compared=$((compared + 1))
  if [ ! -f "$f" ]; then
    missing_on_disk=$((missing_on_disk + 1))
    differ=$((differ + 1))
    if [ "${#samples[@]}" -lt 12 ]; then samples+=("MISSING $f"); fi
    continue
  fi
  disk_hash=$(md5sum "$f" | awk '{print $1}')
  stash_hash=$(git show "stash@{0}:$f" 2>/dev/null | md5sum | awk '{print $1}')
  if [ "$disk_hash" != "$stash_hash" ]; then
    differ=$((differ + 1))
    if [ "${#samples[@]}" -lt 12 ]; then samples+=("DIFF $f"); fi
  fi
done

echo "ui_stash_guard: compared=$compared differ=$differ missing_on_disk=$missing_on_disk"

# Umbral: si >15% o >20 archivos UI difieren del stash, abortar
threshold=20
if [ "$compared" -gt 0 ]; then
  pct=$((differ * 100 / compared))
else
  pct=0
fi

if [ "$differ" -ge "$threshold" ] || [ "$pct" -ge 15 ]; then
  echo "ERROR: el disco NO tiene las mejoras de UI que están en stash@{0}." >&2
  echo "       Deployar ahora PISARÍA Topbar/Shells/páginas que otros agentes ya pusieron en prod." >&2
  echo "       compared=$compared differ=$differ (${pct}%)" >&2
  for s in "${samples[@]}"; do echo "       - $s" >&2; done
  echo "       Acción: aplicar/reconciliar stash UI al path canónico, o DEPLOY_ALLOW_STASH_UI_DRIFT=1 (peligroso)." >&2
  exit 1
fi

echo "OK: drift de UI vs stash@{0} dentro de umbral"
