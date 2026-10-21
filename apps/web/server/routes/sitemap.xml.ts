// /sitemap.xml — páginas fixas + galerias abertas e perfis (vem da API).
// Galeria privada, checkout, pedido e "Minhas fotos" nunca entram.
interface Entrada {
  caminho: string;
  atualizadoEm: string;
}

const FIXAS = ['/', '/eventos', '/planos', '/ensaio', '/download', '/termos', '/privacidade'];

export default defineEventHandler(async (event) => {
  const { apiBase } = useRuntimeConfig().public;
  const origem = getRequestURL(event).origin;
  let dinamicas: Entrada[] = [];
  try {
    const r = await $fetch<{ galerias: Entrada[]; perfis: Entrada[] }>('/publico/sitemap', { baseURL: apiBase });
    dinamicas = [...r.perfis, ...r.galerias];
  } catch {
    // API fora: devolve só as fixas (melhor que erro pro robô do Google)
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const urls = [
    ...FIXAS.map((c) => `<url><loc>${esc(origem + c)}</loc></url>`),
    ...dinamicas.map(
      (e) =>
        `<url><loc>${esc(origem + encodeURI(e.caminho))}</loc><lastmod>${new Date(e.atualizadoEm).toISOString()}</lastmod></url>`,
    ),
  ];
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  setHeader(event, 'Cache-Control', 'public, max-age=3600');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
});
