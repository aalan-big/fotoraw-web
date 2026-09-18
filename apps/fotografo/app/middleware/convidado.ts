/** Entrar / criar conta: quem já está logado vai pro painel. */
export default defineNuxtRouteMiddleware(() => {
  if (useSessao().logado) return navigateTo('/');
});
