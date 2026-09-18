import tailwindcss from '@tailwindcss/vite';

// Admin da plataforma. SPA: área interna, sem SEO; o cookie httpOnly do
// refresh vai direto do navegador pro server — sem proxy de cookie no Nitro.
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,

  modules: ['@pinia/nuxt'],

  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  runtimeConfig: {
    public: {
      // URL do server (NestJS). Sobrescreva com NUXT_PUBLIC_API_BASE.
      apiBase: 'http://localhost:3001/api',
      // vitrine e painel do fotógrafo — links de atalho.
      webUrl: 'http://localhost:3000',
      fotografoUrl: 'http://localhost:3002',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0c0a0b' },
        { name: 'robots', content: 'noindex' },
      ],
      link: [{ rel: 'icon', href: '/favicon.ico' }],
    },
  },
});
