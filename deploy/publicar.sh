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
# sem perguntas no meio do deploy (download do pnpm pelo corepack, telemetria do Nuxt)
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NUXT_TELEMETRY_DISABLED=1
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
# sem stdin e com CI=1 o Prisma não pergunta nada (ex.: "instalar agent skills?")
CI=1 pnpm --filter server db:migrate </dev/null

echo "==> pm2"
# reload não troca cluster → fork: processo antigo em cluster é recriado (só os do usuário fotoraw)
lista_pm2() { pm2 jlist 2>/dev/null | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try { for (const p of JSON.parse(s)) console.log(p.name, p.pm2_env.exec_mode, p.pm2_env.node_version); } catch {}
  })'; }
em_cluster=$(lista_pm2 | awk '$2 == "cluster_mode" { print $1 }' | tr '\n' ' ')
if [[ -n "${em_cluster// /}" ]]; then
  echo "    recriando em fork: $em_cluster"
  pm2 delete $em_cluster
fi
if pm2 describe server >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save >/dev/null

echo
pm2 status
echo "    modo e node de cada processo (esperado: fork_mode e 22.x):"
lista_pm2 | sed 's/^/      /'
echo
echo "saúde: curl -s http://localhost:${PORTA_API:-4001}/api/saude"
# o server leva alguns segundos pra subir depois do reload: tenta por até 60 s
saude=""
for _ in $(seq 1 20); do
  saude=$(curl -s --max-time 5 "http://localhost:${PORTA_API:-4001}/api/saude" || true)
  [[ "$saude" == *'"status":"ok"'* ]] && break
  sleep 3
done
echo "    ${saude:-sem resposta em 60 s — veja: pm2 logs server --lines 50}"
echo
