# Ambiente admin — o espaço do dono pra gerir o negócio

Decisões do dono (2026-09-18):
- O admin é quem **emite, suspende e revoga licenças** — estúdios e fotógrafos dependem disso.
- É uso interno (dono + no máximo alguém de confiança). Não é multi-tenant, não tem cadastro público.
- Toda ação do admin fica na **auditoria** com quem fez, o quê, antes/depois.

Relação com o resto: `docs/fluxos/ambiente-fotografo.md` (o que o fotógrafo vê) e
`docs/banco-de-dados.md` §3.2, §3.5 e §3.7 (as tabelas já existem: `planos`, `assinaturas`,
`licencas`, `faturas`, `repasses`, `auditoria`, `configuracoes_plataforma`, `webhooks_recebidos`).

---

## 1. Identidade

Mesma tabela `contas`, com `papel = admin`. Mesmo `POST /auth/login`, mesmo JWT + refresh em cookie.
O que muda:

| | fotógrafo | admin |
|---|---|---|
| como nasce | cadastro público no painel | **script** `pnpm admin:criar` (nome, e-mail, senha) ou outro admin em *Admins* |
| onde entra | `painel.` (apps/fotografo) | `admin.` (apps/admin) — o app recusa quem não é admin |
| server | `JwtGuard` | `JwtGuard` + `PapelGuard('ADMIN')` em **tudo** sob `/admin/*` |
| antes de ir pro ar | — | **2FA (TOTP)** obrigatório; opcional: lista de IPs |

Um admin não tem perfil público, licença nem galerias. Se um dia o dono também fotografar, usa outra conta.

---

## 2. O que o admin faz (menu)

| item | o que tem | tabelas |
|---|---|---|
| **Visão geral** | contas ativas · trials vencendo em 7 dias · assinaturas ativas e MRR · vendas e comissão do mês · repasses a pagar · webhooks com erro | contas, licencas, assinaturas, pedidos, repasses, webhooks_recebidos |
| **Fotógrafos** | lista com busca (nome, e-mail, @slug), filtro por status/plano. Detalhe: dados, perfil, **licença atual e histórico**, dispositivos, galerias, vendas, auditoria da conta. Ações: **suspender** (vitrine no ar, publicar bloqueado), **bloquear** (nada funciona), reativar, reenviar verificação de e-mail, revogar dispositivo | contas, perfis, licencas, dispositivos, galerias, pedidos |
| **Licenças** | lista (filtro por tipo/status/vencimento). **Emitir manual**: escolhe conta, tipo (`cortesia` \| `vitalicia` \| `trial` estendido), plano-base pros limites (com ajuste fino dos `recursos`), validade, motivo. **Suspender / reativar / revogar**. Emitir substitui a ativa (a anterior vira `revogada` com motivo "substituída") | licencas, planos |
| **Planos** | editar nome, preço, limites e flags (`permite_ensaio`, `permite_gestao_estudio`…), ordem, ativar/desativar (nunca apagar — assinaturas apontam pra ele). Mudar um plano **não** muda licenças já emitidas (snapshot) — o admin escolhe "reemitir pras ativas" se quiser | planos |
| **Assinaturas** | lista por status; detalhe com faturas; **marcar fatura paga** (manual/Pix), cancelar (no fim do período ou já), observação. Depois do passo 6 do fotógrafo, a Stripe alimenta isso sozinha | assinaturas, faturas |
| **Financeiro** | vendas por período, comissão da plataforma, taxas; **repasses**: fila do `pix_manual` (marcar pago + comprovante), extrato dos automáticos | pedidos, pagamentos, repasses |
| **Configurações** | `trial_dias`, `comissao_padrao_pct`, `download_dias_validade`, `download_limite_baixadas`, `pix_reserva_minutos`, e-mails de contato/suporte — sem deploy | configuracoes_plataforma |
| **Auditoria** | log filtrável por ator, ação, alvo, período; mostra antes/depois | auditoria |
| **Sistema** | saúde (banco, e-mail, storage), webhooks recebidos com erro + **reprocessar**, últimos sync_lotes com erro | webhooks_recebidos, sync_lotes |
| **Admins** | listar, criar outro admin, desativar, 2FA | contas |

### Regras que valem em toda ação

- **Auditoria sempre**: `ator_conta_id` = admin, `acao` (`licenca.emitir`, `licenca.revogar`, `conta.suspender`, `plano.editar`, `fatura.marcar_paga`, `repasse.pagar`, `config.alterar`…), `antes`/`depois`.
- **Licença é snapshot**: o desktop lê `licencas.recursos`, não `planos`. Emitir grava os recursos do plano-base + ajustes.
- **Uma ativa por conta** (índice único parcial): emitir nova → a anterior vira `revogada` na mesma transação.
- **Efeito no desktop**: na próxima abertura (ou publicação) ele chama `GET /licencas/atual` e recebe o novo `recursos`. Revogar/suspender → cai pro gratuito (só evento). Bloquear conta → `TokenApiGuard` recusa → desktop volta pra tela de login.
- **Efeito no painel do fotógrafo**: `GET /me` já devolve a licença atual; chip e card do plano mudam no próximo carregamento.
- Nada é apagado: contas, planos e licenças mudam de status.

---

## 3. Endpoints do server (`/admin/*`, todos com `JwtGuard` + `PapelGuard('ADMIN')`)

| módulo | endpoints |
|---|---|
| `admin/visao-geral` | `GET /admin/visao-geral` |
| `admin/contas` | `GET /admin/contas?q&status&plano&pagina` · `GET /admin/contas/:id` (tudo da conta) · `PATCH /admin/contas/:id/status` (`ativa` \| `suspensa` \| `bloqueada`, motivo) · `POST /admin/contas/:id/reenviar-verificacao` · `DELETE /admin/contas/:id/dispositivos/:dispId` |
| `admin/licencas` | `GET /admin/licencas?tipo&status&vence_em` · `POST /admin/licencas` (contaId, tipo, planoBase, recursos?, validaAte?, motivo) · `PATCH /admin/licencas/:id/status` (`suspensa` \| `ativa` \| `revogada`, motivo) · `GET /admin/contas/:id/licencas` (histórico) |
| `admin/planos` | `GET /admin/planos` · `PATCH /admin/planos/:id` · `POST /admin/planos/:id/reemitir` (reemite licenças ativas desse plano com os limites novos) |
| `admin/assinaturas` | `GET /admin/assinaturas?status` · `GET /admin/assinaturas/:id` · `PATCH /admin/assinaturas/:id/cancelar` · `PATCH /admin/faturas/:id/marcar-paga` |
| `admin/financeiro` | `GET /admin/financeiro/resumo?de&ate` · `GET /admin/repasses?status` · `PATCH /admin/repasses/:id/pagar` (comprovante) |
| `admin/configuracoes` | `GET /admin/configuracoes` · `PUT /admin/configuracoes/:chave` |
| `admin/auditoria` | `GET /admin/auditoria?ator&acao&alvoTipo&alvoId&de&ate&pagina` |
| `admin/sistema` | `GET /admin/sistema/saude` · `GET /admin/sistema/webhooks?erro=1` · `POST /admin/sistema/webhooks/:id/reprocessar` |
| `admin/admins` | `GET /admin/admins` · `POST /admin/admins` · `PATCH /admin/admins/:id/status` |
| `auth` (já existe) | `POST /auth/login` (mesmo) · **novo**: `POST /auth/2fa/ativar`, `POST /auth/2fa/confirmar`, login pede o código quando a conta tem 2FA |

Organização no código: `src/modulos/admin/` com um controller + service por área (`contas.admin.controller.ts`…),
reaproveitando os repositórios que já existem (`licencas`, `contas`, `auth`). O `LicencasService` ganha
`emitir(...)`, `alterarStatus(...)` e `reemitirDoPlano(...)` — o que hoje só sabe emitir trial.

---

## 4. `apps/admin` (Nuxt 4, SPA, porta 3003)

Mesma base do `apps/fotografo` (tema, `useApi`, sessão em cookie, layout com menu lateral) — a diferença é
o `middleware/admin.ts` (recusa quem não tem `papel = ADMIN`) e as telas:

```
apps/admin/app/pages/
├── entrar.vue
├── index.vue                 Visão geral
├── fotografos/
│   ├── index.vue             lista + busca + filtros
│   └── [id].vue              detalhe: abas Conta · Licença · Dispositivos · Galerias · Vendas · Auditoria
├── licencas/
│   ├── index.vue             lista
│   └── emitir.vue            formulário (conta, tipo, plano-base, recursos, validade, motivo)
├── planos.vue
├── assinaturas/  index.vue · [id].vue
├── financeiro/   index.vue · repasses.vue
├── configuracoes.vue
├── auditoria.vue
├── sistema.vue
└── admins.vue
```

Visual: mesma linguagem (vinho no item ativo), mas com uma faixa discreta "ADMIN" no cabeçalho pra
nunca confundir com o painel do fotógrafo.

---

## 5. Ordem de implementação

1. **Server — base do admin**: script `pnpm admin:criar`; `PapelGuard` em `/admin/*`; `admin/contas`
   (listar, detalhe, status, dispositivos) e `admin/licencas` (emitir / suspender / revogar / histórico),
   com auditoria. Testes e2e cobrindo: fotógrafo não acessa `/admin`, emitir substitui a ativa, revogar faz
   `GET /licencas/atual` (desktop) cair no gratuito.
2. **`apps/admin`**: instalar Nuxt, layout, entrar, Visão geral, Fotógrafos (lista + detalhe), Licenças
   (lista + emitir). ← aqui o admin já resolve o dia a dia: quem entrou, quem tem licença, dar/tirar licença.
3. **Planos + Configurações** (server + telas).
4. **Assinaturas/faturas manuais + Financeiro/repasses** — a parte automática chega com o passo 6 do
   fotógrafo (Stripe / Mercado Pago), que grava nas mesmas tabelas.
5. **Auditoria + Sistema** (webhooks, saúde).
6. **2FA TOTP + Admins** — obrigatório antes de expor o `admin.` na internet.

Pendências que ficam: "entrar como o fotógrafo" (impersonação) — útil pra suporte, mas sensível; decidir
depois do 2FA. Notificações por e-mail pro admin (trial vencendo, webhook com erro) — fase 2.
