# web — vitrine do FotoRAW (Nuxt 4 + Tailwind 4 + Pinia)

Segue a identidade visual do desktop: tokens em `app/assets/css/main.css`
(`--color-fundo`, `--color-card`, `--color-primaria`, pastilhas coloridas).

```
app/
├── assets/css/main.css   tema (tokens) + utilitários `card` e `pastilha`
├── components/           auto-import por pasta: layout/Cabecalho.vue → <LayoutCabecalho>
├── composables/useApi.ts $fetch apontado pro server (NUXT_PUBLIC_API_BASE)
├── layouts/default.vue   cabeçalho + rodapé da vitrine
├── pages/
│   ├── index.vue         home: hero + busca, eventos recentes, como funciona, fotógrafos
│   ├── eventos.vue       lista/busca de galerias públicas
│   └── entrar/           área do fotógrafo (placeholder)
├── types/                tipos locais até packages/contratos existir
└── utils/formatadores.ts moeda, data, iniciais
server/                   BFF Nitro (OG image, proxies) — vazio por enquanto
```

`pnpm --filter web dev` ou, da raiz, `npm run dev`.
