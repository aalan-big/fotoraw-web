# Subir o FotoRAW web numa VPS (homologação / produção)

Sem Docker: **Node 22 + pnpm + PostgreSQL + Caddy (HTTPS automático) + pm2**. Testado pra
Ubuntu 22.04 / 24.04. Uma VPS de 2 vCPU / 8 GB (Hostinger KVM 2) sobra: os 4 processos Node
usam ~150 MB cada, o Postgres uns 300 MB.

**A VPS pode já ter outro projeto rodando (um site que vende).** O roteiro foi feito pra não
encostar nele:

- não roda `apt upgrade` — nginx/node/postgres do outro site continuam na versão que estão;
- o Node 22 do FotoRAW fica isolado em `/opt/node22`, só no PATH do usuário `fotoraw`;
- o pm2 é do usuário `fotoraw` (daemon próprio) — o pm2 de root, se houver, não é tocado;
- Postgres: se já existir, só cria a role e o banco `fotoraw`; se não, instala;
- Caddy só é instalado se 80/443 estiverem livres; se houver nginx, usa-se o nginx (abaixo);
- firewall: não liga o `ufw`; se já estiver ativo, só libera 80/443.

## O que sobe

| processo | porta interna | domínio público |
|---|---|---|
| `apps/server` (API NestJS) | 3001 | `api.SEU-DOMINIO` |
| `apps/web` (vitrine, SSR) | 3000 | `SEU-DOMINIO` e `www.` |
| `apps/fotografo` (painel, SPA) | 3002 | `painel.SEU-DOMINIO` |
| `apps/admin` (admin, SPA) | 3003 | `admin.SEU-DOMINIO` |

O Caddy fica na frente com HTTPS (Let's Encrypt) e repassa pra essas portas. Nada além de
80/443/22 fica exposto.

## 1. DNS (no registrador do domínio)

Crie 5 registros **A** apontando pro IP da VPS: `@`, `www`, `api`, `painel`, `admin`.
Propaga em minutos, mas confira antes de rodar o Caddy: `dig +short api.SEU-DOMINIO`.

## 2. Preparar a VPS (uma vez)

Entre como root (ou sudo) e rode o instalador — ele é idempotente, pode repetir:

```bash
curl -fsSL https://raw.githubusercontent.com/aalan-big/fotoraw-web/main/deploy/instalar-vps.sh -o instalar-vps.sh
sudo bash instalar-vps.sh
```

O que ele faz: instala Node 22 (isolado em `/opt/node22`), pnpm, pm2, PostgreSQL (se não
houver) e Caddy (se 80/443 estiverem livres); cria o usuário de sistema `fotoraw` e o banco
`fotoraw` (senha gerada e impressa no final — anote); **clona o projeto em
`/home/fotoraw/fotoraw`** com atalho `/root/fotoraw`.

Depois disso, logado como root: `cd fotoraw` já está dentro do projeto. Atalhos no root:
`publicar` (atualiza tudo), `pm2f status`, `logs`.

### Já tem nginx/Apache na VPS?

O instalador detecta. Se as portas estão livres, Caddy (HTTPS sozinho, zero manutenção). Se
for **nginx** do outro site, o Caddy nem é instalado — os domínios do FotoRAW entram como um
site a mais no nginx, sem mexer nos blocos existentes:

```bash
cp /root/fotoraw/deploy/nginx.conf.exemplo /etc/nginx/sites-available/fotoraw
sed -i 's/SEU-DOMINIO/meudominio.com.br/g' /etc/nginx/sites-available/fotoraw
ln -s /etc/nginx/sites-available/fotoraw /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
apt-get install -yq certbot python3-certbot-nginx   # se ainda não tiver
certbot --nginx -d meudominio.com.br -d www.meudominio.com.br -d api.meudominio.com.br -d painel.meudominio.com.br -d admin.meudominio.com.br
```

(`nginx -t` antes do reload garante que, se algo estiver errado, o site atual continua no ar.)

## 3. Código e configuração

```bash
cd fotoraw
cp deploy/env.producao.exemplo apps/server/.env
nano apps/server/.env      # domínio, senha do banco, JWT_SECRET (gere: openssl rand -base64 48)
cp deploy/env.nuxt.exemplo deploy/.env.nuxt
nano deploy/.env.nuxt      # só o domínio
chown fotoraw:fotoraw apps/server/.env deploy/.env.nuxt
```

Variáveis que **precisam** mudar no `apps/server/.env`: `WEB_URL`, `FOTOGRAFO_URL`,
`ADMIN_URL`, `DATABASE_URL` (senha), `JWT_SECRET`, `EMAIL_REMETENTE`. `RESEND_API_KEY` fica
vazio até você criar a conta no Resend (sem ela os e-mails só vão pro log — cadastro
funciona, confirmação de e-mail não chega). `STORAGE_*` só importa quando o sync de fotos
entrar; deixe os placeholders.

## 4. Primeira publicação

```bash
cd fotoraw
publicar                          # instala deps, gera prisma, build dos 4 apps, migra o banco, sobe no pm2
sudo -iu fotoraw bash -c 'cd ~/fotoraw && pnpm admin:criar --nome "Alan" --email seu@email --senha "uma frase longa"'
sudo -iu fotoraw pm2 startup      # copie e rode a linha que ele imprimir
```

O Caddy (ainda como root):

```bash
cp /root/fotoraw/deploy/Caddyfile /etc/caddy/Caddyfile
sed -i 's/SEU-DOMINIO/meudominio.com.br/g' /etc/caddy/Caddyfile
systemctl reload caddy
```

Conferir: `curl -s https://api.SEU-DOMINIO/api/saude` → `{"status":"ok","banco":"ok"}`.
Abra `https://admin.SEU-DOMINIO`, entre, **ative o 2FA** (menu do avatar → Segurança). Em
produção `ADMIN_EXIGE_2FA` é `true` por padrão: sem 2FA o admin só abre a tela de segurança.

## 5. Atualizar (toda vez)

```bash
publicar        # como root, de qualquer pasta (ou: cd fotoraw && bash deploy/publicar.sh)
```

`git pull` → `pnpm install` → build → `prisma migrate deploy` → `pm2 reload` (sem derrubar).
Logs: `logs` ou `pm2f logs server`. Status: `pm2f status`.

## Backup do banco

Diário, 2h da manhã, guarda 14 dias em `/home/fotoraw/backups`:

```bash
sudo -iu fotoraw crontab -e
# 0 2 * * * /home/fotoraw/fotoraw/deploy/backup-banco.sh
```

Restaurar: `psql fotoraw < arquivo.sql`.

## Se quiser manter o Supabase em vez do Postgres local

Só troque `DATABASE_URL`/`DIRECT_URL` no `.env` pelas URLs do projeto Supabase (sa-east-1,
de preferência) e pule a parte do banco no instalador (`SEM_POSTGRES=1 bash instalar-vps.sh`).
Latência São Paulo ↔ VPS conta: se a VPS está no Brasil, o Postgres local é mais rápido.

## Pendências conhecidas pra produção

- Bucket das fotos (R2 ou Supabase Storage) — chega com o módulo `sync`.
- Mercado Pago / Stripe: precisam dos webhooks em `https://api.SEU-DOMINIO/api/webhooks/...`
  (passo 6 do fotógrafo). Já dá pra cadastrar as URLs nos painéis deles depois que a API subir.
- Limitador de tentativas de login é em memória: um processo só (pm2 `instances: 1`, como está).
