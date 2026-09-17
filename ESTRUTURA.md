# fotoraw-web — estrutura de pastas

Monorepo (pnpm workspaces) com a parte web do FotoRAW.
Regra de ouro: **a web nunca processa imagem** — recebe preview (com marca) e alta já prontos do desktop.

```
fotoraw-web/
├── apps/
│   ├── server/      NestJS  — API, sync com o desktop, pagamentos, downloads
│   └── web/          Nuxt 3  — vitrine pública (SSR), checkout, painel do fotógrafo
├── packages/
│   ├── contratos/    tipos TS compartilhados (server ⇄ web ⇄ desktop)
│   ├── config-ts/    tsconfig base
│   └── config-eslint/ regras de lint compartilhadas
├── docs/
│   ├── adr/          decisões de arquitetura (1 arquivo por decisão)
│   └── fluxos/       diagramas: evento (avulso 10%), ensaio (pacote/plano), sync
├── docker/           compose local: postgres, redis, minio (simula R2)
├── scripts/          utilitários de dev/deploy
└── .github/workflows CI
```

## packages/contratos

Trava a interface entre desktop e web antes de escrever os dois lados.
Só tipos e schemas (zod) — sem lógica.

| pasta        | conteúdo                                                        |
|--------------|-----------------------------------------------------------------|
| `sync/`      | payloads desktop → web (publicar ensaio) e web → desktop (pedidos) |
| `contas/`    | Conta, Plano, StatusPlano                                        |
| `galerias/`  | Galeria, TipoGaleria (evento/privado), ModoVenda                 |
| `fotos/`     | Foto, numero_identificacao                                       |
| `pedidos/`   | Pedido, ItemPedido, StatusPedido                                 |
| `pagamentos/`| eventos de webhook normalizados                                  |
| `comum/`     | ids, paginação, erros                                            |

## apps/server (NestJS)

```
src/
├── modulos/            um módulo Nest por domínio (nomes iguais ao desktop)
│   ├── auth/           login web, JWT, api token de longa duração p/ desktop
│   │   ├── dto/
│   │   ├── estrategias/   passport strategies (jwt, api-token)
│   │   └── guards/
│   ├── contas/         fotógrafo + slug (@estudio-luz)
│   ├── planos/         assinatura mensal (cenário ensaio)
│   ├── galerias/       galeria publicada (espelho do ensaio do desktop)
│   ├── fotos/          preview_url / alta_key / numero_identificacao
│   ├── compradores/    dados mínimos p/ recibo (LGPD)
│   ├── pedidos/        carrinho → pedido; eventos/ = domain events (pedido.pago etc.)
│   ├── pagamentos/
│   │   ├── provedores/asaas/   adapter do provedor (Pix, cartão, split 10%)
│   │   └── webhooks/           recebe e valida callbacks
│   ├── downloads/      URL assinada da alta, expiração, registro de baixado_em
│   ├── sync/           endpoints que o FastAPI local chama (URL pré-assinada p/ upload no R2)
│   │   └── guards/     valida o api_token da conta
│   └── publico/        rotas sem auth consumidas pela vitrine (perfil, galeria, busca por número)
│
├── comum/              cross-cutting: decorators, filtros de exceção, guards,
│                       interceptors, pipes, excecoes de domínio, utils
├── config/             leitura/validação de env (app, banco, r2, asaas, resend, redis)
└── infra/              adapters de infraestrutura (sem regra de negócio)
    ├── prisma/         PrismaService + client gerado em gerado/ (git-ignored)
    ├── storage/        cliente R2/S3 — buckets previews (público) e originais (privado)
    ├── fila/           BullMQ; processadores/ = jobs (ingestão, webhook, e-mail)
    ├── email/          Resend; templates/ = recibo, link de download
    └── cache/          Redis

prisma/
├── migrations/
└── seeds/
test/
├── e2e/            *.e2e-spec.ts — app inteira contra o banco fotoraw_test
├── fixtures/       factories (contaFixture, galeriaEventoFixture, fotoFixture)
└── utils/          criarApp(), limparBanco()

Unitários (*.spec.ts) ficam ao lado do arquivo testado, padrão Nest.
```

Padrão dentro de cada módulo: `*.module.ts`, `*.controller.ts`, `*.service.ts`,
`dto/` (validação de entrada/saída) e `repositorios/` (acesso ao Prisma isolado do service).

## apps/web (Nuxt 3)

```
assets/         css global, fontes, imagens de build
components/
├── ui/         botão, input, modal… (sem regra de negócio)
├── layout/     header, footer, nav
├── galeria/    grid de fotos, card, busca por número de peito, lightbox
├── carrinho/   drawer, item, resumo
├── checkout/   formulário do comprador, Pix (QR), cartão, status
├── perfil/     cabeçalho do fotógrafo (@slug)
└── painel/     widgets do painel do fotógrafo
composables/    useCarrinho, useGaleria, useAuth, useApi…
layouts/        default (vitrine), painel, checkout
middleware/     auth (painel), galeria-privada (senha)
pages/
├── @[slug]/            perfil público do fotógrafo
│   └── [galeria]/      galeria pública (SSR + OG tags p/ WhatsApp)
├── painel/             área logada do fotógrafo
│   ├── galerias/
│   ├── pedidos/
│   └── conta/          plano, api token ("Conectar à vitrine")
├── checkout/
├── download/           página de entrega (links assinados)
└── entrar/             login / cadastro
plugins/        cliente HTTP, pinia, etc.
public/         favicon, robots, og padrão
server/
├── api/        BFF leve (proxy p/ server, geração de OG image)
├── middleware/
└── utils/
stores/         pinia (carrinho, sessão)
types/          tipos locais (o que não está em contratos)
utils/          formatadores (moeda, cpf, número de peito)
tests/          unit + e2e
```

## Convenções

- Nomes de pastas e módulos em **pt-BR**, iguais ao desktop (`galerias`, `pedidos`, `fotos`).
- IDs do desktop viajam junto (`ensaio_id`, `foto_id_desktop`) — é o que devolve o pedido pro lugar certo.
- Nada de regra de negócio em `infra/`; nada de acesso a banco fora de `repositorios/`.
