/** Páginas do admin: precisa de sessão E papel ADMIN. Fotógrafo logado é mandado embora. */
export default defineNuxtRouteMiddleware((to) => {
  const sessao = useSessao();
  if (!sessao.logado) {
    return navigateTo({
      path: '/entrar',
      query: to.fullPath !== '/' ? { voltar: to.fullPath } : {},
    });
  }
  if (sessao.conta?.papel !== 'ADMIN') return navigateTo('/entrar?semPermissao=1');
});
