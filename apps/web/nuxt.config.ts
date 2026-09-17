import tailwindcss from '@tailwindcss/vite';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt'],

  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  runtimeConfig: {
    public: {
      // URL do server (NestJS). Sobrescreva com NUXT_PUBLIC_API_BASE.
      apiBase: 'http://localhost:3001/api',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0f0f10' },
      ],
      link: [{ rel: 'icon', href: '/favicon.ico' }],
    },
  },
});
