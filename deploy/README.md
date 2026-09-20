# Subir o FotoRAW web numa VPS (homologação / produção)

Sem Docker: **Node 22 + pnpm + PostgreSQL + Caddy (HTTPS automático) + pm2**. Testado pra
Ubuntu 22.04 / 24.04. Uma VPS de 2 vCPU / 8 GB (Hostinger KVM 2) sobra: os 4 processos Node
usam ~150 MB cada, o Postgres uns 300 MB.

A VPS pode já ter outro projeto. O roteiro não mexe no que está lá: só instala o que falta,
cria um usuário `fotoraw` e um banco próprio. O único ponto de atenção é a porta 80/443 —
ver "Já tem nginx/Apache na VPS?" abaixo.

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

O que ele faz: atualiza o sistema, instala Node 22 (NodeSource), pnpm, PostgreSQL, Caddy e
pm2; cria o usuário de sistema `fotoraw` e o banco `fotoraw` (senha gerada e impressa no
final — anote); abre só 22/80/443 no `ufw`.

### Já tem nginx/Apache na VPS?

`sudo ss -tlnp | grep -E ':80 |:443 '` mostra quem está nas portas. Se for **nginx** de
outro projeto, você tem duas saídas:

- **Caddy em portas altas atrás do nginx** — mais trabalho; ou
- **usar o próprio nginx** pros domínios do FotoRAW: `deploy/nginx.conf.exemplo` tem os
  server blocks; certificado com `certbot --nginx -d SEU-DOMINIO -d www.SEU-DOMINIO -d api.SEU-DOMINIO -d painel.SEU-DOMINIO -d admin.SEU-DOMINIO`.

Se as portas estão livres, siga com o Caddy (recomendado: HTTPS sozinho, zero manutenção).

## 3. Código e configuração

```bash
sudo -iu fotoraw
git clone https://github.com/aalan-big/fotoraw-web.git ~/fotoraw-web
cd ~/fotoraw-web
cp deploy/env.producao.exemplo apps/server/.env
nano apps/server/.env      # domínio, senha do banco, JWT_SECRET (gere: openssl rand -base64 48)
cp deploy/env.nuxt.exemplo deploy/.env.nuxt
nano deploy/.env.nuxt      # só o domínio
```

Variáveis que **precisam** mudar no `apps/server/.env`: `WEB_URL`, `FOTOGRAFO_URL`,
`ADMIN_URL`, `DATABASE_URL` (senha), `JWT_SECRET`, `EMAIL_REMETENTE`. `RESEND_API_KEY` fica
vazio até você criar a conta no Resend (sem ela os e-mails só vão pro log — cadastro
funciona, confirmação de e-mail não chega). `STORAGE_*` só importa quando o sync de fotos
entrar; deixe os placeholders.

## 4. Primeira publicação

```bash
cd ~/fotoraw-web
bash deploy/publicar.sh          # instala deps, gera prisma, build dos 4 apps, migra o banco, sobe no pm2
pnpm admin:criar --nome "Alan" --email seu@email --senha "uma frase longa"
pm2 save && pm2 startup           # copie e rode a linha que o pm2 imprimir (com sudo)
```

Depois, **como root**, o Caddy:

```bash
sudo cp /home/fotoraw/fotoraw-web/deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/SEU-DOMINIO/meudominio.com.br/g' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Conferir: `curl -s https://api.SEU-DOMINIO/api/saude` → `{"status":"ok","banco":"ok"}`.
Abra `https://admin.SEU-DOMINIO`, entre, **ative o 2FA** (menu do avatar → Segurança). Em
produção `ADMIN_EXIGE_2FA` é `true` por padrão: sem 2FA o admin só abre a tela de segurança.

## 5. Atualizar (toda vez)

```bash
sudo -iu fotoraw
cd ~/fotoraw-web && bash deploy/publicar.sh
```

`git pull` → `pnpm install` → build → `prisma migrate deploy` → `pm2 reload` (sem derrubar).
Logs: `pm2 logs`, `pm2 logs server`. Status: `pm2 status`.

## Backup do banco

Diário, 2h da manhã, guarda 14 dias em `/home/fotoraw/backups`:

```bash
sudo -iu fotoraw crontab -e
# 0 2 * * * /home/fotoraw/fotoraw-web/deploy/backup-banco.sh
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
