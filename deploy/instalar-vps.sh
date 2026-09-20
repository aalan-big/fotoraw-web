#!/usr/bin/env bash
# Prepara uma VPS Ubuntu (22.04/24.04) pro FotoRAW web. Idempotente: pode rodar de novo.
#   sudo bash instalar-vps.sh
#   SEM_POSTGRES=1 sudo bash instalar-vps.sh   # se for usar Supabase
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "rode como root (sudo)"; exit 1; fi

USUARIO=fotoraw
BANCO=fotoraw
export DEBIAN_FRONTEND=noninteractive

echo "==> sistema"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq curl git ufw ca-certificates gnupg build-essential

echo "==> node 22 + pnpm"
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1)" != "v22" ]]; then
  # 1º: repositório NodeSource; se o Ubuntu for novo demais pra ele, 2º: binário oficial
  if curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -yq nodejs      && [[ "$(node -v | cut -d. -f1)" == "v22" ]]; then
    echo "    node via NodeSource"
  else
    echo "    NodeSource não serviu — instalando binário oficial do nodejs.org"
    VERSAO=$(curl -fsSL https://nodejs.org/dist/latest-v22.x/ | grep -oE 'node-v22\.[0-9]+\.[0-9]+-linux-x64\.tar\.xz' | head -1)
    curl -fsSL "https://nodejs.org/dist/latest-v22.x/$VERSAO" -o /tmp/node.tar.xz
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
    rm -f /tmp/node.tar.xz
    hash -r
  fi
fi
node -v
corepack enable
corepack prepare pnpm@10.32.1 --activate
npm install -g pm2@latest >/dev/null

echo "==> usuário de sistema '$USUARIO'"
if ! id "$USUARIO" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$USUARIO"
fi

if [[ "${SEM_POSTGRES:-0}" != "1" ]]; then
  echo "==> postgresql"
  apt-get install -yq postgresql postgresql-contrib
  systemctl enable --now postgresql
  SENHA_BANCO="${SENHA_BANCO:-$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)}"
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$USUARIO'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE ROLE $USUARIO LOGIN PASSWORD '$SENHA_BANCO';"
    echo "    role '$USUARIO' criada"
  else
    sudo -u postgres psql -c "ALTER ROLE $USUARIO WITH PASSWORD '$SENHA_BANCO';"
    echo "    role '$USUARIO' já existia — senha redefinida"
  fi
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$BANCO'" | grep -q 1; then
    sudo -u postgres createdb -O "$USUARIO" "$BANCO"
    echo "    banco '$BANCO' criado"
  fi
fi

echo "==> caddy"
if ! command -v caddy >/dev/null; then
  apt-get install -yq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -yq caddy
fi
systemctl enable --now caddy

echo "==> projeto em /home/$USUARIO/fotoraw (+ atalho /root/fotoraw)"
REPO="${REPO:-https://github.com/aalan-big/fotoraw-web.git}"
if [[ ! -d /home/$USUARIO/fotoraw/.git ]]; then
  sudo -u "$USUARIO" -H git clone -q "$REPO" /home/$USUARIO/fotoraw
fi
ln -sfn /home/$USUARIO/fotoraw /root/fotoraw
# como root: `cd fotoraw` entra no projeto; `pm2f`/`publicar` agem como o usuário fotoraw
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

echo "==> firewall (22, 80, 443)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo
echo "================================================================"
echo " pronto."
echo "   node $(node -v) · pnpm $(pnpm -v) · pm2 $(pm2 -v) · caddy $(caddy version | cut -d' ' -f1)"
if [[ "${SEM_POSTGRES:-0}" != "1" ]]; then
  echo "   DATABASE_URL=postgresql://$USUARIO:$SENHA_BANCO@localhost:5432/$BANCO"
  echo "   (anote — vai no apps/server/.env)"
fi
echo " próximo:  cd fotoraw  →  ver deploy/README.md passo 3 (.env) e depois:  publicar"
echo "================================================================"
