/** Antes da primeira rota: recupera a sessão pelo cookie de refresh (se houver). */
export default defineNuxtPlugin(async () => {
  await useSessao().renovar();
});
