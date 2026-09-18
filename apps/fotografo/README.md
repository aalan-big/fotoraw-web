# fotografo — painel do fotógrafo na web (Nuxt 4, SPA)

Versão enxuta do que o desktop faz: o que aconteceu **na vitrine** e o que só existe online
(conta, plano, dinheiro da plataforma, perfil público). Fluxo em `docs/fluxos/ambiente-fotografo.md`.

```bash
pnpm dev:fotografo     # http://localhost:3002 (precisa do server em 3001)
```

Login de dev (seed): `contato@estudioluz.local` / `fotoraw-dev-2026`.

## Como funciona a sessão

- `stores/sessao.ts`: o JWT de acesso fica **em memória**; o refresh é cookie httpOnly do server
  (`fr_sessao`, só em `/api/auth`). `plugins/sessao.client.ts` chama `/auth/refresh` ao abrir o
  app — por isso o F5 mantém logado.
- `composables/useApi.ts`: `$fetch` com Bearer; num 401 renova uma vez e repete; se não der, manda pro `/entrar`.
- `middleware/autenticado` (painel) e `convidado` (entrar / criar conta).
- SPA (`ssr: false`): área logada, sem SEO, e o cookie vai direto do navegador pro server.

## Telas

| rota | o que faz |
|---|---|
| `/entrar`, `/criar-conta`, `/recuperar-senha`, `/redefinir-senha` | identidade |
| `/verificar-email?token=` (`&troca=1` pra troca de e-mail) | destino dos links de e-mail |
| `/` | Início: pendências (verificar e-mail, completar perfil, licença vencendo), plano, como conectar o desktop |
| `/perfil` | perfil público + dados fiscais/Pix + quem paga a taxa do provedor |
| `/dispositivos` | máquinas conectadas, desconectar |
| `/conta` | nome, e-mail (reconfirmação), senha, excluir conta |
| `/galerias`, `/vendas`, `/financeiro`, `/plano` | placeholders — chegam com sync, pedidos, Mercado Pago e Stripe |

Layout `painel`: menu lateral fixo com as seções Vitrine / Financeiro / Conta (item ativo em vinho),
cabeçalho com nome do estúdio e chip da licença. Componentes em `components/ui` (Campo, Botao,
Alerta, Cartao, EmBreve).
