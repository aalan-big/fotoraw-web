#!/usr/bin/env bash
# Dump diário do banco do FotoRAW, guarda 14 dias. Cron do usuário fotoraw:
#   0 2 * * * /home/fotoraw/fotoraw/deploy/backup-banco.sh
set -euo pipefail
DIR="$HOME/backups"
mkdir -p "$DIR"
ARQ="$DIR/fotoraw-$(date +%F).sql.gz"
# banco no container db_fotoraw (padrão) ou Postgres do sistema
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx db_fotoraw; then
  docker exec db_fotoraw pg_dump -U fotoraw fotoraw | gzip > "$ARQ"
else
  pg_dump fotoraw | gzip > "$ARQ"
fi
find "$DIR" -name 'fotoraw-*.sql.gz' -mtime +14 -delete
echo "ok: $ARQ ($(du -h "$ARQ" | cut -f1))"
