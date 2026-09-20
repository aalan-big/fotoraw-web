#!/usr/bin/env bash
# Prepara uma VPS Ubuntu (22.04+) pro FotoRAW web SEM mexer no que já roda nela.
#   sudo bash instalar-vps.sh
#   SEM_POSTGRES=1 sudo bash instalar-vps.sh   # se for usar Supabase
#
# Regras de convivência com outro projeto na mesma VPS:
#  - não roda `apt upgrade` (não atualiza nginx/node/postgres de ninguém)
#  - Node 22 vai isolado em /opt/node22, só no PATH do usuário `fotoraw` — o node do sistema fica como está
#  - pm2 é do usuário `fotoraw` (daemon próprio); o pm2 de root/outro usuário não é tocado
#  - Caddy só entra se as portas 80/443 estiverem livres
#  - firewall: não liga o ufw; se já estiver ativo, só libera 80/443
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "rode como root (sudo)"; exit 1; fi

USUARIO=fotoraw
BANCO=fotoraw
NODE_DIR=/opt/node22
REPO="${REPO:-https://github.com/aalan-big/fotoraw-web.git}"
export DEBIAN_FRONTEND=noninteractive

echo "==> pacotes básicos (sem upgrade do sistema)"
apt-get update -q
apt-get install -yq curl git ca-certificates gnupg build-essential xz-utils

echo "==> usuário de sistema '$USUARIO'"
if ! id "$USUARIO" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$USUARIO"
fi

echo "==> node 22 isolado em $NODE_DIR"
if [[ ! -x $NODE_DIR/bin/node ]] || [[ "$($NODE_DIR/bin/node -v | cut -d. -f1)" != "v22" ]]; then
  VERSAO=$(curl -fsSL https://nodejs.org/dist/latest-v22.x/ | grep -oE 'node-v22\.[0-9]+\.[0-9]+-linux-x64\.tar\.xz' | head -1)
  curl -fsSL "https://nodejs.org/dist/latest-v22.x/$VERSAO" -o /tmp/node22.tar.xz
  rm -rf "$NODE_DIR" && mkdir -p "$NODE_DIR"
  tar -xJf /tmp/node22.tar.xz -C "$NODE_DIR" --strip-components=1
  rm -f /tmp/node22.tar.xz
fi
export PATH="$NODE_DIR/bin:$PATH"
"$NODE_DIR/bin/corepack" enable --install-directory "$NODE_DIR/bin"
"$NODE_DIR/bin/corepack" prepare pnpm@10.32.1 --activate
"$NODE_DIR/bin/npm" install -g pm2@latest >/dev/null
echo "    node $($NODE_DIR/bin/node -v) · pnpm $($NODE_DIR/bin/pnpm -v) · pm2 $($NODE_DIR/bin/pm2 -v)"
if command -v node >/dev/null 2>&1 && [[ "$(command -v node)" != "$NODE_DIR/bin/node" ]]; then
  echo "    (node do sistema em $(command -v node) $(node -v) fica intacto)"
fi
# PATH do usuário fotoraw (login shell e non-login)
for arq in /home/$USUARIO/.profile /home/$USUARIO/.bashrc; do
  touch "$arq"
  grep -q "$NODE_DIR/bin" "$arq" || echo "export PATH=$NODE_DIR/bin:\$PATH" >> "$arq"
  chown $USUARIO:$USUARIO "$arq"
done

if [[ "${SEM_POSTGRES:-0}" != "1" ]]; then
  echo "==> postgresql"
  if ! command -v psql >/dev/null 2>&1; then
    apt-get install -yq postgresql postgresql-contrib
  else
    echo "    já instalado ($(psql --version)) — só criando role e banco"
  fi
  systemctl enable --now postgresql >/dev/null 2>&1 || true
  SENHA_BANCO="${SENHA_BANCO:-$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)}"
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$USUARIO'" | grep -q 1; then
    sudo -u postgres psql -qc "CREATE ROLE $USUARIO LOGIN PASSWORD '$SENHA_BANCO';"
    echo "    role '$USUARIO' criada"
  else
    sudo -u postgres psql -qc "ALTER ROLE $USUARIO WITH PASSWORD '$SENHA_BANCO';"
    echo "    role '$USUARIO' já existia — senha redefinida"
  fi
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$BANCO'" | grep -q 1; then
    sudo -u postgres createdb -O "$USUARIO" "$BANCO"
    echo "    banco '$BANCO' criado"
  fi
  PORTA_PG=$(sudo -u postgres psql -tAc "SHOW port" 2>/dev/null || echo 5432)
fi

echo "==> portas 80/443"
OCUPANTE=$(ss -tlnp 2>/dev/null | grep -E ':(80|443) ' | grep -oE 'users:\(\("[^"]+"' | grep -oE '"[^"]+"' | tr -d '"' | sort -u | tr '\n' ' ' || true)
if [[ -z "$OCUPANTE" || "$OCUPANTE" == "caddy " ]]; then
  echo "==> caddy (portas livres)"
  if ! command -v caddy >/dev/null; then
    apt-get install -yq debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -q
    apt-get install -yq caddy
  fi
  systemctl enable --now caddy
  PROXY=caddy
else
  echo "    ocupadas por: $OCUPANTE — Caddy NÃO instalado. Use deploy/nginx.conf.exemplo (ver README)."
  PROXY="$OCUPANTE"
fi

echo "==> firewall"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
  echo "    ufw já ativo: liberado 80/443 (nada mais alterado)"
else
  echo "    ufw não está ativo — não liguei (ligar poderia bloquear portas do outro projeto)"
fi

echo "==> projeto em /home/$USUARIO/fotoraw (+ atalho /root/fotoraw)"
if [[ ! -d /home/$USUARIO/fotoraw/.git ]]; then
  sudo -u "$USUARIO" -H git clone -q "$REPO" /home/$USUARIO/fotoraw
fi
ln -sfn /home/$USUARIO/fotoraw /root/fotoraw
if ! grep -q "fotoraw-atalhos" /root/.bashrc 2>/dev/null; then
  cat >> /root/.bashrc <<'ATALHOS'

# --- fotoraw-atalhos ---
alias pm2f='sudo -iu fotoraw pm2'
alias publicar='bash /home/fotoraw/fotoraw/deploy/publicar.sh'
alias logs='sudo -iu fotoraw pm2 logs'
# `cd fotoraw` funciona de qualquer pasta
cd() { if [[ "${1:-}" == "fotoraw" && ! -d "fotoraw" ]]; then builtin cd /root/fotoraw; else builtin cd "$@"; fi; }
ATALHOS
fi

echo
echo "================================================================"
echo " pronto — nada do que já rodava na VPS foi alterado."
if [[ "${SEM_POSTGRES:-0}" != "1" ]]; then
  echo "   DATABASE_URL=postgresql://$USUARIO:$SENHA_BANCO@localhost:${PORTA_PG:-5432}/$BANCO"
  echo "   (anote — vai no apps/server/.env)"
fi
echo "   proxy: $PROXY"
echo " próximo:  source ~/.bashrc ; cd fotoraw  →  README passo 3 (.env)  →  publicar"
echo "================================================================"
