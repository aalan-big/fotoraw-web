#!/usr/bin/env bash
# Publica (ou atualiza) o FotoRAW web na VPS. Rodar como o usuário `fotoraw`, dentro do repo:
#   cd fotoraw && bash deploy/publicar.sh   (ou só `publicar`, como root)
# Faz: git pull → pnpm install → prisma generate → build dos 4 apps → migrate deploy → pm2 reload.
set -euo pipefail
# rodou como root? repassa pro usuário dono do projeto (pm2 e node_modules são dele)
if [[ $EUID -eq 0 ]]; then
  exec sudo -u fotoraw -H bash /home/fotoraw/fotoraw/deploy/publicar.sh "$@"
fi
# node 22 isolado (instalar-vps.sh) — não depende do node do sistema
[[ -d /opt/node22/bin ]] && export PATH="/opt/node22/bin:$PATH"
cd "$(dirname "$0")/.."

if [[ ! -f apps/server/.env ]]; then
  echo "falta apps/server/.env — copie de deploy/env.producao.exemplo"; exit 1
fi
if [[ ! -f deploy/.env.nuxt ]]; then
  echo "falta deploy/.env.nuxt — copie de deploy/env.nuxt.exemplo"; exit 1
fi

echo "==> código"
git pull --ff-only

echo "==> dependências"
pnpm install --frozen-lockfile

echo "==> prisma client"
pnpm --filter server db:generate

echo "==> build (server + web + fotografo + admin)"
# as URLs públicas entram no bundle do Nuxt em build; vêm de deploy/.env.nuxt
set -a; source deploy/.env.nuxt; set +a
pnpm --filter server build
pnpm --filter web build
pnpm --filter fotografo build
pnpm --filter admin build

echo "==> migrations"
pnpm --filter server db:migrate

echo "==> pm2"
if pm2 describe server >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save >/dev/null

echo
pm2 status
echo
echo "saúde: curl -s http://localhost:${PORTA_API:-4001}/api/saude"
curl -s --max-time 10 "http://localhost:${PORTA_API:-4001}/api/saude" || true
echo
