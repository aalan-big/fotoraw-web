# server — API web do FotoRAW (NestJS 12 + Prisma 7 + Postgres)

## Subir em dev

Tudo da raiz do monorepo, um terminal só:

```bash
npm run db            # Postgres local via `prisma dev` (sem Docker), porta 5433, fica em background
npm run db:migrate    # primeira vez / quando mudar o schema
npm run db:seed       # conta "estudio-luz" + galeria "corrida-2026"
npm run dev           # server (3001) + web (3000)
```

- API: http://localhost:3001/api/saude
- Vitrine: http://localhost:3000

Na primeira vez, crie o banco: o `prisma dev` sobe vazio, então rode uma vez
`npm run db:migrate` — ele cria `fotoraw` se não existir. Pra parar: `npm run db:stop`.

Alternativa com Docker (Postgres + Redis + MinIO): `npm run infra` e ajuste
`DATABASE_URL` no `.env` pra porta 5432 (veja `.env.example`).

## Scripts

| script               | o que faz                                                |
|----------------------|----------------------------------------------------------|
| `start:dev`          | Nest em watch mode                                       |
| `typecheck`          | `tsc --noEmit`                                           |
| `lint`               | oxlint                                                   |
| `test`               | unitários (`src/**/*.spec.ts`) — sem banco               |
| `test:e2e`           | e2e (`test/e2e/**/*.e2e-spec.ts`) — precisa do docker up |
| `db:start` / `db:stop` | Postgres local via `prisma dev` (sem Docker)           |
| `db:migrate`         | `prisma migrate dev` (cria/aplica migration)             |
| `db:migrate:test`    | aplica migrations no banco `fotoraw_test`                |
| `db:seed`            | roda `prisma/seeds/index.ts`                             |
| `db:studio`          | Prisma Studio                                            |

## Testes

- **Unitários** ficam ao lado do arquivo testado (`saude.service.spec.ts`).
  Mockam `PrismaService` via `Test.createTestingModule`.
- **E2E** sobem a app inteira (`test/utils/criar-app.ts`) contra o banco
  `fotoraw_test`. Use `limparBanco(app)` no `beforeEach` e as factories de
  `test/fixtures/` para montar o cenário.

Antes do primeiro e2e: `pnpm --filter server db:migrate:test`.

## Convenções

- ESM (`"type": "module"`): imports internos terminam em `.js`.
- DTOs são schemas **zod** validados pelo `ZodValidationPipe` (não class-validator),
  para compartilhar com `packages/contratos`.
- Erros de negócio estendem `DominioExcecao` com um `codigo` estável;
  o `HttpExcecaoFiltro` padroniza a resposta `{ status, codigo, mensagem, erros? }`.
- Acesso ao banco só em `repositorios/` de cada módulo, nunca direto no service.
- Client do Prisma é gerado em `src/infra/prisma/gerado/` (ignorado no git;
  `postinstall` regenera).
