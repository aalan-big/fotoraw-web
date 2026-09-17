# Ambiente do fotógrafo — identidade, vínculo com o desktop e o painel web

Decisões do dono (2026-09-18):
- Vínculo desktop ↔ web é **automático por e-mail e senha** — sem código de dispositivo, sem colar token.
- Cadastro só na web. O desktop nunca cria conta; ele entra com a conta que existe.
- O desktop continua funcionando offline.

---

## 1. Identidade

**A web é a única fonte de identidade** (`contas.email` + `contas.senha_hash`).

| onde | como entra | o que recebe |
|---|---|---|
| apps/fotografo (web) | e-mail + senha | JWT de acesso (15 min) + refresh em cookie httpOnly (7 dias, rotativo) |
| desktop (Tauri/FastAPI) | e-mail + senha, **uma vez, online** | `token_api` (opaco, 1 ano, renovável) + licença atual. Guarda o hash da senha localmente pra login offline depois |
| apps/admin | e-mail + senha de conta com `papel = admin` | JWT + refresh (mesma tabela, papel diferente) |

### Primeiro login no desktop (é aqui que o vínculo acontece)

```
desktop                                            server
  │ tela de login: e-mail + senha                     │
  │── POST /auth/dispositivo ─────────────────────────►│ 1. valida e-mail/senha (argon2id)
  │   { email, senha, fingerprint, nome_maquina,      │ 2. checa contas.status (bloqueada → nega)
  │     versao_app }                                  │ 3. checa limite_dispositivos da licença
  │                                                   │ 4. upsert dispositivos (conta_id + fingerprint)
  │                                                   │ 5. gera token_api (32 bytes aleatórios),
  │                                                   │    grava só o sha256 em tokens_api
  │◄── { token_api, conta, perfil, licenca } ─────────│ 6. auditoria: dispositivo.vinculado
  │ guarda token + hash local da senha (argon2)       │
  │ "Conectado como @estudio-luz · licença PRO"       │
```

Logins seguintes no desktop: **offline** confere com o hash local; **online** usa o `token_api`
(nunca reenvia a senha). Se o token foi revogado na web, o desktop volta pra tela de login.

### Regras de segurança (o "plano seguro")

| risco | tratamento |
|---|---|
| senha vazada por hash fraco | **argon2id** (memória 64 MB, 3 iterações). Mínimo 8 caracteres, checagem contra lista de senhas comuns |
| força bruta no login | rate limit por e-mail **e** por IP: 5 tentativas / 15 min, bloqueio progressivo (Redis / ThrottlerModule). Mesma resposta genérica "e-mail ou senha inválidos" |
| token do desktop vazado | token opaco de 256 bits, só o **hash** no banco; `ultimo_uso_em`; revogável na web (Dispositivos); expira em 1 ano e renova sozinho no uso |
| trocar senha não derruba sessões | trocar senha **revoga todos os refresh e tokens_api** (o desktop pede login de novo, uma vez) |
| refresh token roubado | rotação a cada uso; reuso de token antigo = revoga a família inteira |
| e-mail falso no cadastro | verificação obrigatória por link (Resend) **antes de publicar**; sem verificar, só navega |
| recuperação de senha | token de uso único, 30 min, por e-mail; nunca revela se o e-mail existe |
| máquinas demais | `licencas.recursos.limite_dispositivos`; excedeu → a web mostra quais revogar |
| tokens OAuth do Mercado Pago | cifrados com AES-256-GCM (`CHAVE_CIFRA_TOKENS`), nunca logados, nunca voltam pra API |
| transporte | TLS obrigatório; cookies `Secure` + `SameSite=Lax`; CORS só pros três apps; helmet |
| admin | papel separado; 2FA (TOTP) antes de ir pro ar |
| rastreabilidade | `auditoria` grava: login em novo dispositivo, revogação, troca de senha, mudanças financeiras |

Tabelas novas (migration 8): `sessoes_web` (refresh tokens: hash, user agent, ip, expira, revogado)
e `tokens_verificacao` (tipo `verificar_email | redefinir_senha`, hash, expira, usado_em).

---

## 2. O painel web do fotógrafo (`apps/fotografo`)

Princípio: **enxuto**. Tudo que envolve arquivo, edição, agenda, contrato e financeiro do estúdio
continua no desktop. A web mostra o que aconteceu **na vitrine** e cuida do que só existe online:
dinheiro da plataforma, plano, conexão de pagamento, perfil público.

### Menu

| item | o que tem | tabelas |
|---|---|---|
| **Início** | resumo: vendas do mês, saldo a receber, galerias no ar, pendências ("conecte o Mercado Pago", "complete o perfil", "verifique o e-mail", "licença vence em 5 dias") | pedidos, repasses, galerias, licencas |
| **Galerias** | as publicadas: status, link + QR, código de acesso (privadas), pausar/encerrar, "ver como o cliente vê". **Não edita fotos** — isso é no desktop | galerias, fotos |
| **Vendas** | pedidos: filtro por galeria/período/status, comprador, itens, valor, comissão, repasse; marcar "entregue" quando modo entrega; exportar CSV | pedidos, itens_pedido, pagamentos |
| **Financeiro** | saldo a receber (view), extrato de repasses, **conectar Mercado Pago** (OAuth), **taxas: repassar ao cliente ou absorver**, dados pra nota (CNPJ/CPF), chave Pix | repasses, conexoes_pagamento, perfis |
| **Plano** | plano atual + limites usados, licença (chave, validade), faturas, **assinar PRO** (Stripe, cartão), trocar, cancelar | planos, assinaturas, licencas, faturas |
| **Perfil público** | o que aparece em `/@slug`: nome fantasia, bio, logo, capa, WhatsApp, Instagram, cidade — com pré-visualização | perfis |
| **Dispositivos** | máquinas conectadas (nome, última atividade, versão), revogar | dispositivos, tokens_api |
| **Conta** | e-mail, senha, notificações por e-mail (venda, seleção do cliente), excluir conta | contas, sessoes_web |

### Ambientes (rotas)

```
apps/fotografo/app/pages/
├── entrar.vue                 login (visual já existe)
├── criar-conta.vue            nome, e-mail, senha, slug (@estudio) → verificação por e-mail
├── recuperar-senha.vue        pedir link / definir nova senha
├── index.vue                  Início
├── galerias/
│   ├── index.vue              lista
│   └── [id].vue               detalhe: link, QR, código, status, vendas desta galeria
├── vendas/
│   ├── index.vue              lista + filtros
│   └── [numero].vue           pedido: comprador, itens, pagamento, repasse
├── financeiro/
│   ├── index.vue              saldo + extrato
│   ├── mercado-pago.vue       conectar/desconectar (OAuth callback)
│   └── taxas.vue              quem paga a taxa; dados fiscais; chave Pix
├── plano/
│   ├── index.vue              plano, licença, limites
│   ├── assinar.vue            checkout Stripe
│   └── faturas.vue
├── perfil.vue
├── dispositivos.vue
└── conta.vue
```

Layout: menu lateral fixo (mesma linguagem do desktop: item ativo vinho, seções "Vitrine",
"Financeiro", "Conta"), cabeçalho com nome do estúdio e status da licença.

### Vender: o que o fotógrafo configura e onde

| decisão | onde | efeito |
|---|---|---|
| preço por foto / pacote / entrega | **desktop**, ao publicar | `galerias.modo_venda`, `preco_*` |
| quem paga a taxa do provedor | web → Financeiro → Taxas | `perfis.taxas_para_cliente` → `pedidos.taxa_cliente_centavos` |
| receber o dinheiro | web → Financeiro → Mercado Pago | `conexoes_pagamento`; sem isso a galeria publica mas **não vende** (aviso no desktop e no Início) |
| galeria privada com seleção | precisa de plano PRO | `licencas.recursos.permite_galeria_privada` — o desktop só oferece a opção se a licença permite |
| pausar venda | web → Galerias | `galerias.status = pausada` (link no ar, compra bloqueada) |

---

## 3. Endpoints do server por módulo

| módulo | endpoints |
|---|---|
| `auth` | `POST /auth/cadastro` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/sair` · `POST /auth/dispositivo` (desktop) · `POST /auth/verificar-email` · `POST /auth/recuperar-senha` · `POST /auth/redefinir-senha` |
| `contas` | `GET /me` · `PATCH /me` (nome, e-mail c/ reverificação) · `PUT /me/senha` · `GET/PUT /me/perfil` · `GET /me/dispositivos` · `DELETE /me/dispositivos/:id` |
| `licencas` | `GET /licencas/atual` (desktop, a cada N dias) — devolve `recursos` + `valida_ate` |
| `planos` | `GET /planos` · `POST /assinaturas` (Stripe Checkout) · `POST /assinaturas/cancelar` · `GET /faturas` · webhook Stripe |
| `financeiro` | `GET /financeiro/saldo` · `GET /financeiro/repasses` · `GET /financeiro/mercado-pago/conectar` (redirect OAuth) · `GET /financeiro/mercado-pago/callback` · `DELETE /financeiro/mercado-pago` · `PATCH /financeiro/taxas` |
| `galerias` (fotógrafo) | `GET /galerias` · `GET /galerias/:id` · `PATCH /galerias/:id/status` |
| `pedidos` (fotógrafo) | `GET /pedidos` · `GET /pedidos/:numero` · `PATCH /pedidos/:numero/entregue` |
| `sync` (desktop, token_api) | `PUT /sync/perfil` · `POST /sync/lotes` · `POST /sync/lotes/:id/confirmar` · `GET /sync/pedidos?desde=` |

Guards: `JwtGuard` (web), `TokenApiGuard` (desktop), `PapelGuard('admin')`.

---

## 4. Ordem de implementação

1. **Migration 8**: `sessoes_web`, `tokens_verificacao`.
2. **Server `auth`**: cadastro, login, refresh, sair, verificar e-mail, recuperar senha, `POST /auth/dispositivo`. Argon2, rate limit, auditoria. Testes e2e cobrindo força bruta e revogação.
3. **Server `contas` + `licencas`**: `/me`, perfil, dispositivos, `GET /licencas/atual`. Licença trial emitida automaticamente no cadastro.
4. **`apps/fotografo`**: instalar Nuxt, tema compartilhado, layout com menu lateral, entrar / criar conta / recuperar, Início, Perfil, Dispositivos, Conta.
5. **Desktop** (repositório `fotoraw-main`): tela de login passa a aceitar a conta web; guarda token; checa licença.
6. **Financeiro + Plano**: OAuth Mercado Pago, taxas, Stripe Checkout, faturas.
7. **Galerias + Vendas** na web (leitura) — depende do sync de publicação existir.
