# admin — gestão da plataforma (Nuxt 4, SPA, porta 3003)

O espaço do dono: fotógrafos, licenças, planos, assinaturas, financeiro, auditoria.
Plano completo em `docs/fluxos/ambiente-admin.md`.

```bash
pnpm dev:admin        # http://localhost:3003 (precisa do server em 3001)
pnpm admin:criar --nome "Nome" --email x@y --senha "..."   # cria/promove um admin
```

Mesma base do `apps/fotografo` (sessão em cookie, `useApi`, tema), com `middleware/admin.ts`
recusando quem não tem `papel = ADMIN`.

Pronto: Visão geral, Fotógrafos (lista, detalhe com licenças/dispositivos/galerias/auditoria,
suspender/bloquear/reativar), Licenças (lista, emitir, suspender/reativar/revogar).
Placeholders: Planos, Assinaturas, Financeiro, Configurações, Auditoria, Sistema, Admins.
