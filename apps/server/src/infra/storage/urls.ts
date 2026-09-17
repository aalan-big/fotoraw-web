/**
 * O banco guarda só a CHAVE no bucket. A URL pública de preview é montada aqui.
 * Em dev o seed pode usar URLs completas (picsum) — passam direto.
 */
export function urlPublica(basePreviews: string, chave: string | null): string | null {
  if (!chave) return null;
  if (/^https?:\/\//.test(chave)) return chave;
  return `${basePreviews.replace(/\/$/, '')}/${chave.replace(/^\//, '')}`;
}
