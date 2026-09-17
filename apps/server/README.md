# server — API web do FotoRAW (NestJS 12 + Prisma 7 + Postgres)

## Subir em dev

```bash
# 1. infra local (postgres, redis, minio)   — na raiz do monorepo
npm run infra

# 2. env
cp apps/server/.env.example apps/server/.env

# 3. banco
npm run db:migrate                   # aplica migrations no fotoraw
npm run db:seed                      # conta "estudio-luz" + galeria "corrida-2026"

# 4. api
npm run dev                          # http://localhost:3001/api/saude
```

## Scripts

| script               | o que faz                                                |
|----------------------|----------------------------------------------------------|
| `start:dev`          | Nest em watch mode                                       |
| `typecheck`          | `tsc --noEmit`                                           |
| `lint`               | oxlint                                                   |
| `test`               | unitários (`src/**/*.spec.ts`) — sem banco               |
| `test:e2e`           | e2e (`test/e2e/**/*.e2e-spec.ts`) — precisa do docker up |
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
