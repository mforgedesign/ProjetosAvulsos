#!/usr/bin/env bash
set -euo pipefail
# Sincronização opcional Windows->VPS. Configure MFORGE_WINDOWS_SYNC_SOURCE para ativar.
# Exemplo seguro: MFORGE_WINDOWS_SYNC_SOURCE='usuario@host:/caminho/conversas/'
BASE=/opt/mforge-insights
SRC=${MFORGE_WINDOWS_SYNC_SOURCE:-}
if [[ -z "$SRC" ]]; then
  echo '{"ok":false,"reason":"MFORGE_WINDOWS_SYNC_SOURCE not configured; no-op"}'
  exit 0
fi
rsync -az --delay-updates --exclude='*.tmp' --exclude='*.part' --exclude='*.crdownload' "$SRC" "$BASE/inbox/conversas/"
python3 "$BASE/scripts/queue_state.py" scan --conversations "$BASE/inbox/conversas" --since 2025-12-01
