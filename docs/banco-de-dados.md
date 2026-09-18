# Banco de dados — modelo aplicado (migrations 4–8)

> Estado: **aplicado no Supabase** (projeto iysabguxvdgbvmjmmlgj, us-west-2) e no banco local — 21 tabelas + view `saldos_fotografo`, seed rodado.

Base: `fotoraw-main/docs/web/banco-de-dados.md` (relatório do desktop, 17 tabelas) cruzado com o
`apps/server/prisma/schema.prisma` atual (10 tabelas, 3 migrations aplicadas).

Este documento é o **alvo**. Depois de aprovado vira 4 migrations (seção 6).

---

## 1. Onde o modelo atual e o relatório divergem — e o que fica

| tema | schema atual | relatório do desktop | decisão |
|---|---|---|---|
| dinheiro | `Decimal(10,2)` | `bigint` centavos | **centavos** (`*_centavos bigint`). Sem arredondamento, igual ao desktop. |
| ids | `uuid(7)` gerado na app | `gen_random_uuid()` no banco | **uuid v7 na app** — ordenável por tempo, ajuda índice e paginação. Mesmo tipo `uuid` no banco. |
| enums | `MAIUSCULO` | `minusculo` pt-BR | Prisma `MAIUSCULO` no código, **`@map` minúsculo no banco** — o banco fica igual ao desktop, o TS fica idiomático. |
| galeria: tipo | `modalidade` + `visibilidade` + `categoria` | `tipo evento\|privado` | **fica o nosso** (superset): `tipo` do desktop vira `visibilidade`; `modalidade` espelha interno/externo/evento; `categoria` alimenta a home e o chip. Portfólio precisa disso. |
| cliente de ensaio | (não tinha) | `compradores` + senha na galeria | **relatório**: `compradores` serve os dois cenários; galeria privada tem `codigo_acesso` + `senha_hash`. Sem tabela `clientes` — o desktop é dono do cliente. |
| token do desktop | `contas.api_token_hash` | tabela `tokens_api` | **`tokens_api`** (1 conta : N máquinas, revogação individual). |
| plano | enum `GRATUITO\|PRO` | tabela `planos` | **tabela** — admin muda preço/limite sem deploy. |
| upload | (não tinha) | `sync_lotes`, sem tabela por arquivo | **`sync_lotes`** + estado por foto em `fotos.alta_key/preview_key` (null = não subiu). Tabela por arquivo só se a retomada exigir. |
| status do pedido | `REEMBOLSADO` | `estornado` | **`estornado`** (mesmo nome do pagamento). |
| centavos | — | `bigint` | **`int4`** (limite R$ 21 mi por valor) — evita BigInt no JSON do Nest. |
| datas | `timestamp(3)` | `timestamptz` | **`timestamp(3)`** (padrão Prisma; app grava UTC). Trocar por `@db.Timestamptz` se algum dia houver leitura direta fora da app. |
| provedores | asaas/mercadopago | asaas/mercadopago/manual | **mercadopago** (vendas, marketplace: fotógrafo conecta a conta) · **stripe** (assinatura de plano) · manual |
| taxas | — | — | fotógrafo escolhe em `perfis.taxas_para_cliente`; pedido guarda `taxa_cliente_centavos` (repassada) e `taxa_provedor_centavos` (real). **Comissão sempre sobre o subtotal do produto.** |

---

## 2. Visão geral

```
ADMIN / LICENÇAS                 FOTÓGRAFO                         VITRINE (comprador)
────────────────                 ─────────                         ───────────────────
planos ◄── assinaturas ──► contas ─┬─ perfis                       compradores
              │                    ├─ tokens_api                   pedidos ──┬─ itens_pedido
           faturas                 ├─ dispositivos                 pagamentos│
licencas ──────────────────────────┤                               downloads ┘
auditoria                          ├─ galerias ─── fotos           selecoes (fase 2)
configuracoes_plataforma           ├─ repasses
webhooks_recebidos                 └─ sync_lotes
```

**MVP: 19 tabelas** (17 do relatório + `perfis` separado + `webhooks_recebidos` já existente).
Fase 2: `selecoes`, `cupons`.

---

## 3. Tabelas

Convenções: `id uuid PK`, `criado_em/atualizado_em timestamptz` em todas (omitidos abaixo).
`conta_id` NOT NULL + índice em toda tabela do fotógrafo.

### 3.1 Contas e acesso

**`contas`** — fotógrafo, estúdio ou admin (um por login)
`email citext UNIQUE` · `senha_hash` · `nome` · `slug citext UNIQUE` (imutável após publicar) ·
`status: ativa | suspensa | bloqueada` · `papel: fotografo | admin` · `email_verificado_em?` · `excluido_em?`
> Sai daqui: `plano`, `status_plano`, `api_token_*`, `provedor_pagamento*` (vão pra planos/tokens_api/perfis).

**`perfis`** — como aparece na vitrine (1:1, PK = `conta_id`)
`nome_fantasia` · `bio?` · `logo_key?` · `capa_key?` · `whatsapp?` · `instagram?` · `site?` · `cidade?` · `uf char(2)?` ·
`cnpj_cpf?` (só dígitos) · `chave_pix?` · `taxas_para_cliente bool` (repassa a taxa do provedor ao comprador ou absorve)

**`conexoes_pagamento`** — conta do fotógrafo no provedor (OAuth Mercado Pago)
`conta_id` · `provedor` · `provedor_usuario_id` (collector_id) · `access_token_cifrado` · `refresh_token_cifrado?` ·
`token_expira_em?` · `rotulo?` · `conectado_em` · `revogado_em?` · UNIQUE `(conta_id, provedor)`
> A comissão do marketplace (10%) cai na conta MP da plataforma; a Stripe recebe só assinaturas.
> O desktop empurra isso no sync (espelha `estudio`).

**`tokens_api`** — o que o desktop usa pra sincronizar
`conta_id` · `token_hash UNIQUE` · `nome` ("Notebook do estúdio") · `ultimo_uso_em?` · `expira_em?` · `revogado_em?`

**`dispositivos`** — máquinas que ativaram a licença
`conta_id` · `fingerprint` · `nome` (hostname) · `versao_app?` · `ultimo_visto_em` · UNIQUE `(conta_id, fingerprint)`

**`sessoes_web`** — refresh tokens da web (fotógrafo e admin); o desktop usa `tokens_api`
`conta_id` · `familia uuid` · `token_hash UNIQUE` (sha256) · `user_agent?` · `ip?` · `expira_em` · `usada_em?` · `revogada_em?`
> Rotação: cada `/auth/refresh` marca `usada_em` e cria outra sessão na mesma `familia`. Reuso de uma já usada = roubo → revoga a família.

**`tokens_verificacao`** — links de uso único por e-mail
`conta_id` · `tipo: verificar_email | redefinir_senha | trocar_email` · `token_hash UNIQUE` · `dados jsonb?` (ex.: e-mail novo) · `expira_em` · `usado_em?`

### 3.2 Planos, assinaturas e licenças (admin)

Plano (catálogo) ≠ assinatura (contrato de cobrança) ≠ licença (direito de uso que o desktop checa).

**`planos`**
`codigo UNIQUE` (`gratuito`, `pro_mensal`, `pro_anual`) · `nome` · `preco_centavos` · `periodicidade: mensal | anual | nenhuma` ·
`comissao_evento_pct numeric(5,2)` · `limite_galerias_ativas?` · `limite_fotos_por_galeria?` · `limite_armazenamento_mb?` ·
`limite_dispositivos?` · `permite_galeria_privada bool` · `permite_evento bool` · `ativo bool` · `ordem int`

**`assinaturas`**
`conta_id` · `plano_id` · `status: trial | ativa | inadimplente | cancelada | expirada` · `inicio_em` ·
`periodo_atual_inicio` · `periodo_atual_fim` · `cancelada_em?` · `cancela_no_fim_do_periodo bool` ·
`provedor: stripe | manual` · `provedor_assinatura_id? UNIQUE` · `origem: site | admin` · `observacao_admin?`
Índices: `(conta_id, status)`.

**`licencas`**
`conta_id` · `assinatura_id?` (null = cortesia) · `chave UNIQUE` (`FR-XXXX-XXXX-XXXX`) ·
`tipo: assinatura | cortesia | vitalicia | trial` · `status: ativa | suspensa | revogada | expirada` · `valida_ate?` ·
`recursos jsonb` (snapshot dos limites na emissão) · `emitida_por?` (FK contas, admin) · `motivo?` · `emitida_em`
> **Uma licença `ativa` por conta**: índice único parcial `(conta_id) WHERE status = 'ativa'` (SQL manual na migration).

**`faturas`**
`assinatura_id` · `valor_centavos` · `vencimento date` · `status: pendente | paga | vencida | cancelada | estornada` ·
`provedor_cobranca_id? UNIQUE` · `paga_em?` · `url_boleto_pix?`

### 3.3 Vitrine — o que é publicado

**`galerias`** — um ensaio publicado
`conta_id` · `ensaio_id_desktop` · UNIQUE `(conta_id, ensaio_id_desktop)` · `slug citext` · UNIQUE `(conta_id, slug)` ·
`titulo` · `descricao?` ·
`modalidade: evento | ensaio_interno | ensaio_externo` · `visibilidade: publica | privada | portfolio` · `categoria` (enum, seção 4) ·
`modo_venda: avulso | pacote | entrega` · `preco_foto_centavos?` · `fotos_incluidas?` · `preco_pacote_centavos?` (informativo) ·
`permite_download_gratis bool` (modo entrega) ·
`capa_key?` · `codigo_acesso? UNIQUE` (`LUZ-4821`, galeria privada) · `senha_hash?` ·
`data_evento date?` · `cidade?` · `uf char(2)?` ·
`status: rascunho | publicada | pausada | encerrada` · `publicada_em?` · `encerra_em?` ·
`total_fotos int` · `total_vendas_centavos bigint` (cache, atualizado pelo service) · `excluido_em?`
Índices: `(conta_id, status)`, `(status, visibilidade, publicada_em)`, `codigo_acesso`.
> Muda vs. hoje: `capa_url` → `capa_key`; `expira_em` → `encerra_em`; `+ pausada/encerrada`; `+ codigo_acesso`; `+ caches`; preços em centavos.

**`fotos`**
`galeria_id` · `foto_id_desktop` · UNIQUE `(galeria_id, foto_id_desktop)` ·
`preview_key` (com marca, bucket público) · `thumb_key` · `alta_key?` (privado; null = não subiu) ·
`largura` · `altura` · `tamanho_alta_bytes?` · `numero_identificacao?` · `preco_centavos?` (sobrescreve galeria) ·
`ordem` · `status: ativa | oculta`
Índices: `(galeria_id, numero_identificacao)`, `(galeria_id, ordem)`.
> Fase 2, se OCR errar número: `pg_trgm` em `numero_identificacao`.

**`selecoes`** *(fase 2 — cenário pacote)*
`galeria_id` · `foto_id` · `comprador_id` · `incluida bool` · `pedido_id?` (se extra, quem pagou) ·
`status: rascunho | enviada | aprovada` · `enviada_em?` · UNIQUE `(galeria_id, foto_id, comprador_id)`
> É o que vira `selecao_feita` no desktop.

### 3.4 Vitrine — quem compra e o que compra

**`compradores`** — sem `conta_id` (compra de vários fotógrafos), sem senha (link mágico)
`email citext UNIQUE` · `nome` · `whatsapp?` · `cpf?` (só dígitos, se o provedor exigir) · `aceitou_termos_em`

**`pedidos`**
`numero bigint UNIQUE` (sequence) · `conta_id` (desnormalizado: relatório do fotógrafo) · `galeria_id` · `comprador_id` ·
`status: aberto | aguardando_pagamento | pago | cancelado | expirado | estornado` ·
`subtotal_centavos` (valor do produto, base da comissão) · `desconto_centavos default 0` · `taxa_cliente_centavos default 0` · `total_centavos` (= subtotal − desconto + taxa_cliente) ·
`comissao_pct numeric(5,2)` (**snapshot** do plano) · `comissao_centavos` · `taxa_provedor_centavos?` · `repasse_centavos` ·
`expira_em?` (reserva do Pix) · `pago_em?` · `sincronizado_desktop_em?`
Índices: `(conta_id, status, pago_em)`, `(conta_id, sincronizado_desktop_em)`, `galeria_id`, `comprador_id`.

**`itens_pedido`**
`pedido_id` · `foto_id` · `preco_centavos` (**snapshot**) · `incluida bool` (pacote: dentro das N, preço 0) · UNIQUE `(pedido_id, foto_id)`

**`pagamentos`** — uma tentativa por linha
`pedido_id` · `provedor: stripe | manual` · `metodo: pix | cartao | boleto` ·
`provedor_pagamento_id UNIQUE` (idempotência do webhook) ·
`status: criado | pendente | aprovado | recusado | estornado | expirado` · `valor_centavos` ·
`pix_copia_cola?` · `pix_qr_key?` · `pix_expira_em?` · `split_aplicado bool` · `payload jsonb?` · `aprovado_em?`

**`downloads`** — gerados **só na aprovação** do pagamento
`pedido_id` · `foto_id` · `comprador_id` · `token UNIQUE` · `expira_em` · `limite_baixadas int default 5` ·
`baixadas int default 0` · `ultimo_download_em?` · UNIQUE `(pedido_id, foto_id)`

### 3.5 Dinheiro do fotógrafo

**`repasses`**
`conta_id` · `periodo_inicio date` · `periodo_fim date` · `valor_centavos` ·
`status: aberto | solicitado | pago | falhou` · `metodo: split_automatico | pix_manual` ·
`provedor_transferencia_id?` · `pago_em?` · `comprovante_key?`
> Com split no provedor vira extrato; sem split, é a fila do admin pagar. **Saldo é view**, não coluna.

### 3.6 Sincronização com o desktop

**`sync_lotes`**
`conta_id` · `token_api_id` · `galeria_id?` · `tipo: publicar | atualizar_fotos | despublicar | puxar_pedidos` ·
`chave_idempotencia UNIQUE` (o desktop gera) · `status: recebido | processando | concluido | erro` ·
`total_itens` · `itens_ok` · `itens_erro` · `erro?` · `iniciado_em` · `concluido_em?`

Fluxo de upload (arquivo **nunca passa pelo Nest**):
```
desktop ── POST /sync/lotes (galeria + fotos: id, tipo, tamanho, sha256) ──► server: cria lote, upsert galeria/fotos,
                                                                                    devolve URL PUT assinada por arquivo
desktop ── PUT direto no bucket (paralelo, retoma) ──► R2/Supabase Storage
desktop ── POST /sync/lotes/:id/confirmar ──► server: HEAD em cada chave, confere tamanho, grava preview_key/alta_key,
                                                      lote concluido (ou lista de falhas pro desktop reenviar)
```

### 3.7 Operacional e admin

**`webhooks_recebidos`** *(existe)* — `provedor` · `evento_ref UNIQUE` · `tipo` · `payload jsonb` · `processado_em?` · `erro?`
Gravar → responder 200 → processar em fila.

**`auditoria`** — `ator_conta_id?` · `acao` (`licenca.emitir`, `conta.suspender`, `assinatura.marcar_paga`…) ·
`alvo_tipo` · `alvo_id` · `antes jsonb?` · `depois jsonb?` · `ip?`

**`configuracoes_plataforma`** — `chave PK` · `valor jsonb` · `atualizado_em`
(comissão padrão, dias de download, minutos de reserva do Pix, e-mails)

---

## 4. Enums (valores no banco, minúsculos)

```
conta.status         ativa | suspensa | bloqueada
conta.papel          fotografo | admin
token_verificacao.tipo verificar_email | redefinir_senha | trocar_email
plano.periodicidade  mensal | anual | nenhuma
assinatura.status    trial | ativa | inadimplente | cancelada | expirada
assinatura.origem    site | admin
licenca.tipo         assinatura | cortesia | vitalicia | trial
licenca.status       ativa | suspensa | revogada | expirada
fatura.status        pendente | paga | vencida | cancelada | estornada
galeria.modalidade   evento | ensaio_interno | ensaio_externo
galeria.visibilidade publica | privada | portfolio
galeria.categoria    corrida_rua | trail | ciclismo | triatlo | natacao | esportivo | formatura | casamento | festa |
                     corporativo | gestante | newborn | familia | infantil | quinze_anos | casal | pessoal | moda | produto | outro
galeria.modo_venda   avulso | pacote | entrega
galeria.status       rascunho | publicada | pausada | encerrada
foto.status          ativa | oculta
pedido.status        aberto | aguardando_pagamento | pago | cancelado | expirado | estornado
pagamento.status     criado | pendente | aprovado | recusado | estornado | expirado
pagamento.metodo     pix | cartao | boleto
provedor             mercadopago | stripe | manual
repasse.status       aberto | solicitado | pago | falhou
repasse.metodo       split_automatico | pix_manual
sync.tipo            publicar | atualizar_fotos | despublicar | puxar_pedidos
sync.status          recebido | processando | concluido | erro
selecao.status       rascunho | enviada | aprovada          (fase 2)
```

---

## 5. Fluxos → tabelas

| fluxo | tabelas na ordem |
|---|---|
| Publicar (desktop → web) | `tokens_api` → `licencas.recursos` (limites) → `sync_lotes` → `galerias` upsert → `fotos` upsert → URLs → confirmar → `sync_lotes` concluído |
| Comprar foto de evento | `compradores` upsert por e-mail → `pedidos` aberto → `itens_pedido` (snapshot) → `pagamentos` Pix → webhook → `webhooks_recebidos` → `pagamentos` aprovado → `pedidos` pago → `downloads` → e-mail |
| Acessar ensaio privado | `galerias.codigo_acesso` + `senha_hash` → cookie de sessão da galeria → (fase 2) `selecoes` |
| Desktop puxa vendas | `GET /sync/pedidos?desde=` → `pedidos` + itens com `foto_id_desktop` → `sincronizado_desktop_em` |
| Assinar PRO | `assinaturas` → provedor → `faturas` por ciclo → webhook → `periodo_atual_fim` → `licencas.valida_ate` |
| Inadimplência | fatura vencida + N dias → `assinaturas.inadimplente` → `licencas.suspensa` → `contas.suspensa` (vitrine no ar, publicar bloqueado) |
| Admin emite licença | `licencas` (cortesia/vitalícia, `emitida_por`) → `auditoria` |
| Fechamento do fotógrafo | `repasses` por período = Σ `pedidos.repasse_centavos` pagos; saldo = view |

---

## 6. Plano de migrations (a partir do que existe)

| # | nome | o que faz |
|---|---|---|
| 4 | `fundacao` | dinheiro → centavos; enums `@map` minúsculo; `contas` (+status, papel, email_verificado_em, excluido_em; −plano, −api_token, −provedor); **+perfis**, **+tokens_api**, **+dispositivos** |
| 5 | `planos_e_licencas` | **+planos** (seed: gratuito, pro_mensal, pro_anual), `assinaturas` reestruturada, **+licencas** (índice parcial), **+faturas** |
| 6 | `vitrine` | `galerias` (capa_key, codigo_acesso, pausada/encerrada, encerra_em, caches, excluido_em), `fotos` (thumb_key, tamanho, status), `compradores` (email unique, termos), `pedidos` (numero, desconto, comissao_pct, repasse, taxa, estornado), `pagamentos` (criado/expirado, boleto, split, manual), `downloads` (comprador_id, limite, ultimo) |
| 7 | `operacional` | **+repasses**, **+sync_lotes**, **+auditoria**, **+configuracoes_plataforma** (seed dos valores padrão) |
| 8 | `auth_sessoes` | **+sessoes_web** (refresh rotativo por família), **+tokens_verificacao** (verificar e-mail, redefinir senha, trocar e-mail) |
| fase 2 | `selecoes_e_cupons` | **+selecoes**, **+cupons** |

Cada migration vai com o SQL revisado à mão (como a 3), não só o diff — principalmente a 4 (conversão de dinheiro) e a 5 (índice parcial).

---

## 7. Cuidados que entram no código, não só no banco

- Recalcular `total_centavos` no servidor a partir de `itens_pedido` × preço atual; nunca confiar no front.
- `downloads` só no handler do webhook aprovado.
- LGPD: anonimizar `compradores` (nome, e-mail, cpf → hash) N meses após o último pedido; `aceitou_termos_em` obrigatório no checkout.
- Retenção: `alta_key` de galeria `encerrada` pode sair do bucket após `downloads.expira_em`; a linha em `fotos` fica.
- `conta_id` desnormalizado em `pedidos` (sim) e em `fotos` (não — passa pela galeria).
