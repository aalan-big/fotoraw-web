#!/usr/bin/env bash
# Dump diário do Postgres local, guarda 14 dias. Cron do usuário fotoraw:
#   0 2 * * * /home/fotoraw/fotoraw-web/deploy/backup-banco.sh
set -euo pipefail
DIR="$HOME/backups"
mkdir -p "$DIR"
ARQ="$DIR/fotoraw-$(date +%F).sql.gz"
pg_dump fotoraw | gzip > "$ARQ"
find "$DIR" -name 'fotoraw-*.sql.gz' -mtime +14 -delete
echo "ok: $ARQ ($(du -h "$ARQ" | cut -f1))"
