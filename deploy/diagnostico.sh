#!/usr/bin/env bash
# SÓ LEITURA. Não instala, não altera, não reinicia nada. Mostra o que já roda na VPS
# pra planejar a entrada do FotoRAW sem encostar no que está em produção.
#   bash diagnostico.sh
set -uo pipefail

linha() { echo; echo "## $1"; }

linha "sistema"
. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"
uname -r
uptime -p 2>/dev/null
echo "reinício pendente: $([[ -f /var/run/reboot-required ]] && echo SIM || echo não)"

linha "recursos"
free -h | sed -n '1,2p'
df -h / | sed -n '1,2p'
nproc | xargs -I{} echo "cpus: {}"

linha "portas em uso (quem escuta onde)"
ss -tlnpH 2>/dev/null | awk '{print $4, $6}' | sed 's/users:(("//; s/",pid=/ pid=/; s/,fd=.*//' | sort -t: -k2 -n | uniq

linha "conflito com as portas que o FotoRAW quer (3000 3001 3002 3003 5432)"
for p in 3000 3001 3002 3003 5432; do
  q=$(ss -tlnpH 2>/dev/null | grep -E "[:.]$p " | grep -oE '"[^"]+"' | head -1 | tr -d '"')
  [[ -n "$q" ]] && echo "  $p: OCUPADA por $q" || echo "  $p: livre"
done

linha "servidor web / proxy"
for s in nginx apache2 caddy httpd; do
  if systemctl is-active --quiet "$s" 2>/dev/null; then echo "  $s: ATIVO"; fi
done
[[ -d /etc/nginx/sites-enabled ]] && { echo "  sites nginx:"; ls -1 /etc/nginx/sites-enabled 2>/dev/null | sed 's/^/    /'; }
[[ -f /etc/caddy/Caddyfile ]] && echo "  Caddyfile existe"

linha "node / pnpm / pm2 (o que já existe)"
for b in node npm pnpm yarn pm2 bun; do
  if command -v "$b" >/dev/null 2>&1; then echo "  $b: $(command -v "$b") $("$b" --version 2>/dev/null | head -1)"; fi
done
[[ -x /opt/node22/bin/node ]] && echo "  /opt/node22: $(/opt/node22/bin/node -v) (isolado do FotoRAW)"

linha "processos pm2 (root)"
command -v pm2 >/dev/null 2>&1 && pm2 ls 2>/dev/null | head -20 || echo "  pm2 não encontrado no PATH do root"
for u in $(ls /home 2>/dev/null); do
  if [[ -d "/home/$u/.pm2" ]]; then
    echo "  pm2 do usuário $u:"; sudo -u "$u" -H bash -lc 'pm2 ls' 2>/dev/null | head -20 | sed 's/^/    /'
  fi
done

linha "processos node em execução"
ps -eo user,pid,rss,cmd --sort=-rss 2>/dev/null | grep -E "node|next|nuxt|pm2" | grep -v grep | head -15 | awk '{printf "  %-10s pid=%-7s %6d MB  ", $1, $2, $3/1024; for(i=4;i<=NF;i++) printf "%s ", $i; print ""}'

linha "postgresql"
if command -v psql >/dev/null 2>&1; then
  psql --version
  command -v pg_lsclusters >/dev/null 2>&1 && pg_lsclusters
  sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datistemplate = false" 2>/dev/null | sed 's/^/  banco: /'
else
  echo "  não instalado"
fi
for s in mysql mariadb mongod redis-server; do
  systemctl is-active --quiet "$s" 2>/dev/null && echo "  $s: ATIVO"
done

linha "firewall"
if command -v ufw >/dev/null 2>&1; then ufw status 2>/dev/null | head -15; else echo "  ufw não instalado"; fi
command -v iptables >/dev/null 2>&1 && echo "  regras iptables: $(iptables -S 2>/dev/null | wc -l)"

linha "ssh"
grep -E "^\s*Port\s" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null || echo "  porta padrão 22"

linha "usuários com home"
ls -1 /home 2>/dev/null | sed 's/^/  /'
id fotoraw >/dev/null 2>&1 && echo "  (usuário fotoraw já existe)"

linha "docker"
command -v docker >/dev/null 2>&1 && docker ps --format '  {{.Names}}  {{.Ports}}' 2>/dev/null || echo "  não instalado"

echo
echo "fim — manda tudo isso pra quem vai planejar a instalação."
