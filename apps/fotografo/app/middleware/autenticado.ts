/** Páginas do painel. Sem sessão → login, guardando pra onde a pessoa ia. */
export default defineNuxtRouteMiddleware((to) => {
  const sessao = useSessao();
  if (!sessao.logado) {
    return navigateTo({
      path: '/entrar',
      query: to.fullPath !== '/' ? { voltar: to.fullPath } : {},
    });
  }
});
