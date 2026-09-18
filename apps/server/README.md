# server — API web do FotoRAW (NestJS 12 + Prisma 7 + Postgres)

## Subir em dev

Banco: **Supabase** (Postgres gerenciado). No painel do projeto → *Connect* → *ORMs* →
*Prisma*, copie as duas URLs pro `apps/server/.env`:

- `DATABASE_URL` — Session pooler (runtime da API)
- `DIRECT_URL` — migrations e seed. A conexão direta (`db.[ref].supabase.co`) é só IPv6; sem IPv6 na rede, use o mesmo Session pooler.

Senha com `@`, `#`, `%` ou `/` precisa vir URL-encoded (`@` → `%40`).

Depois, tudo da raiz do monorepo, um terminal só:

```bash
npm run db:migrate    # aplica as migrations no Supabase (primeira vez / quando mudar o schema)
npm run db:seed       # contas "estudio-luz" e "marcosfoco" (senha: fotoraw-dev-2026) + galerias
npm run dev           # server (3001) + web (3000)
```

- API: http://localhost:3001/api/saude
- Vitrine: http://localhost:3000

Sem internet / sem Supabase: `npm run db` sobe um Postgres local (`prisma dev`, porta 5433);
aponte as duas URLs pra ele (exemplo comentado no `.env.example`).

## Scripts

| script               | o que faz                                                |
|----------------------|----------------------------------------------------------|
| `start:dev`          | Nest em watch mode                                       |
| `typecheck`          | `tsc --noEmit`                                           |
| `lint`               | oxlint                                                   |
| `test`               | unitários (`src/**/*.spec.ts`) — sem banco               |
| `test:e2e`           | e2e (`test/e2e/**/*.e2e-spec.ts`) — precisa do docker up |
| `db:start` / `db:stop` | Postgres local via `prisma dev` (sem Docker)           |
| `db:migrate`         | aplica migrations pendentes (`migrate deploy`) — Supabase  |
| `db:migrate:nova`    | cria migration nova a partir do schema (`migrate dev`)    |
| `db:migrate:test`    | aplica migrations no banco `fotoraw_test`                |
| `db:seed`            | roda `prisma/seeds/index.ts`                             |
| `db:studio`          | Prisma Studio                                            |

## Testes

- **Unitários** ficam ao lado do arquivo testado (`saude.service.spec.ts`).
  Mockam `PrismaService` via `Test.createTestingModule`.
- **E2E** sobem a app inteira (`test/utils/criar-app.ts`) contra o banco
  `fotoraw_test`. Use `limparBanco(app)` no `beforeEach` e as factories de
  `test/fixtures/` para montar o cenário.

Os e2e **não** usam o Supabase: rodam no Postgres local (`npm run db`), banco `fotoraw_test`.
Antes do primeiro e2e: `npm run db` e depois `pnpm --filter server db:migrate:test`.

## Auth (docs/fluxos/ambiente-fotografo.md)

| quem | como | guard |
|---|---|---|
| web (fotógrafo/admin) | `POST /auth/login` → `{ acesso }` (JWT 15 min) + cookie httpOnly `fr_sessao` (refresh 7 dias, rotativo, só em `/api/auth`) | `JwtGuard` (+ `PapelGuard` com `@Papel('ADMIN')`) |
| desktop | `POST /auth/dispositivo` (e-mail + senha + fingerprint) → `{ tokenApi }` opaco, 1 ano, renova no uso | `TokenApiGuard` |

Uso nos outros módulos: `@UseGuards(JwtGuard)` no controller e `@ContaAtual() conta: Conta` no handler.

Conta logada (`JwtGuard`): `GET /me` (conta + perfil + licença + pendências) · `PATCH /me` (nome; e-mail com
reconfirmação) · `PUT /me/senha` (devolve sessão nova) · `GET/PUT /me/perfil` · `GET /me/dispositivos` ·
`DELETE /me/dispositivos/:id` (revoga o token da máquina) · `POST /me/excluir` (exclusão lógica, pede a senha).

Licença: o cadastro emite um **trial** de `trial_dias` (config, 14) com os limites do PRO; vencido, a conta cai no
`gratuito`. Desktop consulta `GET /licencas/atual` com o `token_api`. Formato de `recursos` (snake_case, o desktop lê):
`src/modulos/licencas/recursos-licenca.ts`.

- Senha: argon2id (64 MB, 3 it.), mínimo 8, lista de senhas comuns.
- Força bruta: 5 falhas / 15 min por e-mail (`LimitadorTentativas`, em memória) **e** por IP (`@Throttle`, desligado em `test`).
- Trocar/redefinir senha revoga todas as sessões web e todos os tokens do desktop.
- E-mails (verificar, redefinir, trocar e-mail) saem pelo Resend; sem `RESEND_API_KEY` o link é logado no console.

## Convenções

- ESM (`"type": "module"`): imports internos terminam em `.js`.
- DTOs são schemas **zod** validados pelo `ZodValidationPipe` (não class-validator),
  para compartilhar com `packages/contratos`.
- Erros de negócio estendem `DominioExcecao` com um `codigo` estável;
  o `HttpExcecaoFiltro` padroniza a resposta `{ status, codigo, mensagem, erros? }`.
- Acesso ao banco só em `repositorios/` de cada módulo, nunca direto no service.
- Client do Prisma é gerado em `src/infra/prisma/gerado/` (ignorado no git;
  `postinstall` regenera).
