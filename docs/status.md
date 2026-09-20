# Status do projeto — atualizado em 2026-09-20

Onde o trabalho parou, pra retomar sem reler o histórico. Os planos completos estão em
`docs/fluxos/ambiente-fotografo.md` e `docs/fluxos/ambiente-admin.md`.

## Feito

**Ambiente do fotógrafo** (passos 1–5 de 7)
- Server: migrations 8–11; módulos `auth`, `contas`, `licencas`; 44 e2e (`pnpm --filter server test:e2e`,
  precisa do Postgres local: `pnpm db`).
- Sessões web: fotógrafo em `/auth/*` (cookie `fr_sessao`, 7 dias); admin em `/auth/admin/*` (cookie
  `fr_admin`, some ao fechar o navegador, 12h). Papel checado no server (`403 PAINEL_ERRADO`).
- `apps/fotografo` (3002): entrar, criar conta, recuperar senha, Início, perfil, dispositivos, conta.
- Desktop (`fotoraw-main`): login com a conta web (online/offline), licença em cache, módulos de gestão
  bloqueados no gratuito. **Pendente: teste visual no Tauri.**

**Ambiente admin** (passos 1–4 de 6)
- Server `/admin/*` (`@SoAdmin()`): contas, licenças, visão geral, planos (editar + reemitir licenças
  ativas), configurações (catálogo tipado em `admin/configuracoes.catalogo.ts`). Tudo auditado.
- `apps/admin` (3003): entrar, visão geral, fotógrafos (lista/detalhe/ações), licenças (lista/emitir/status),
  planos (edição inline, tirar de venda, reemitir), configurações (salvar por campo).
- Licença guarda de que plano veio no `motivo` (`plano:<id> · …`) — é assim que o admin conta/reemite.
- Painel 360 na lista de fotógrafos (`GET /admin/contas/:id/resumo`): saúde, uso contra o plano,
  ações rápidas, linha do tempo unificada. Regras em `admin/resumo-conta.ts`.
- Assinaturas manuais (Pix): `POST /admin/assinaturas`, `PATCH /admin/faturas/:id/marcar-paga`
  (renova período + licença `ASSINATURA` + próxima fatura), `PATCH /admin/assinaturas/:id/cancelar`
  (no fim do período ou agora). Fatura vencida vira `VENCIDA`/`INADIMPLENTE` na leitura (sem job ainda).
  Pagamento depois do período acabar reinicia o período no dia do pagamento. Telas em `apps/admin/pages/assinaturas/`.
- Financeiro: `GET /admin/financeiro/resumo?de&ate` (vendas, comissão, taxas, assinaturas recebidas,
  por dia, por fotógrafo), `GET /admin/financeiro/saldos` (saldo = Σ repasse dos pedidos pagos − Σ
  repasses gerados; nunca é coluna), fila `POST /admin/repasses` → `PATCH …/pagar | …/falhou`
  (Pix manual; falhou devolve o valor ao saldo). Seed cria 14 pedidos pagos de exemplo (`pnpm db:seed`
  recria pedidos/repasses das contas seed).
- `pnpm admin:criar --nome --email --senha` cria ou promove um admin.

**Regra de negócio**: gratuito = só vender foto de evento (10%); ensaio, galeria privada e gestão do
estúdio no desktop são PRO (`licencas.recursos.permite_*`).

## Falta

- Fotógrafo passo 6: Mercado Pago (OAuth, vendas) + Stripe (assinatura) — precisa de HTTPS público.
- Fotógrafo passo 7: Galerias/Vendas na web — depende do módulo `sync` (desktop → web), não iniciado.
- Admin passos 5–6: auditoria + sistema; 2FA + admins. Comprovante de repasse (upload) depende do bucket.
- Job de cobrança (fatura vencida + N dias → suspender licença/conta) — hoje só marca na leitura.
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
