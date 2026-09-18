export default defineNuxtRouteMiddleware(() => {
  const sessao = useSessao();
  if (sessao.logado && sessao.conta?.papel === 'ADMIN') return navigateTo('/');
});
