# Status do projeto — atualizado em 2026-09-18

Onde o trabalho parou, pra retomar sem reler o histórico. Os planos completos estão em
`docs/fluxos/ambiente-fotografo.md` e `docs/fluxos/ambiente-admin.md`.

## Feito

**Ambiente do fotógrafo** (passos 1–5 de 7)
- Server: migrations 8–10; módulos `auth`, `contas`, `licencas`; 37 e2e (`pnpm --filter server test:e2e`,
  precisa do Postgres local: `pnpm db`).
- `apps/fotografo` (3002): entrar, criar conta, recuperar senha, Início, perfil, dispositivos, conta.
- Desktop (`fotoraw-main`): login com a conta web (online/offline), licença em cache, módulos de gestão
  bloqueados no gratuito. **Pendente: teste visual no Tauri.**

**Ambiente admin** (passos 1–2 de 6)
- Server `/admin/*` (`@SoAdmin()`): contas, licenças, visão geral, planos (leitura). Tudo auditado.
- `apps/admin` (3003): entrar, visão geral, fotógrafos (lista/detalhe/ações), licenças (lista/emitir/status).
- `pnpm admin:criar --nome --email --senha` cria ou promove um admin.

**Regra de negócio**: gratuito = só vender foto de evento (10%); ensaio, galeria privada e gestão do
estúdio no desktop são PRO (`licencas.recursos.permite_*`).

## Falta

- Fotógrafo passo 6: Mercado Pago (OAuth, vendas) + Stripe (assinatura) — precisa de HTTPS público.
- Fotógrafo passo 7: Galerias/Vendas na web — depende do módulo `sync` (desktop → web), não iniciado.
- Admin passos 3–6: planos editáveis + configurações; assinaturas/faturas + financeiro/repasses;
  auditoria + sistema; 2FA + admins.
- Homologação na VPS (sem Docker: Caddy + pm2 + Postgres) — precisa de domínio.

## Decisões em aberto

- Trial vencido com ensaios publicados: ficam no ar sem publicar novos (sugestão) ou saem do ar?
- Bucket das fotos: R2 (sugestão) ou Supabase Storage. Região do Supabase: us-west-2 → sa-east-1.
- "Entrar como o fotógrafo" no admin — só depois do 2FA.

## Subir em dev

`pnpm dev` na raiz (um terminal só) → 3000 vitrine · 3001 API · 3002 painel · 3003 admin.
Sanidade: `http://localhost:3001/api/saude` responde JSON; HTML = Nuxt na porta errada.

Contas de dev: admins `admin@fotoraw.local` / `admin-dev-2026` (e a conta do dono);
fotógrafos `contato@estudioluz.local` e `marcos@foco.local` / `fotoraw-dev-2026`.
