import { defineStore } from 'pinia';
import type { FotoPublica } from '~/types/galeria';

interface ItemCarrinho {
  fotoId: string;
  url: string | null;
  numero: string | null;
  precoCentavos: number;
}

const CHAVE = 'fotoraw:carrinho';

/**
 * Fotos escolhidas, por galeria. Fica no localStorage do comprador (não
 * precisa de conta). No pacote, guarda também quantas ainda saem sem pagar.
 */
export const useCarrinho = defineStore('carrinho', () => {
  const porGaleria = ref<Record<string, ItemCarrinho[]>>({});
  /** pacote: quantas ainda saem sem pagar e o preço da extra (o server recalcula de qualquer jeito) */
  const regras = ref<Record<string, { restantes: number; extraCentavos: number }>>({});
  let carregado = false;

  /** Chamar no onMounted: no SSR não existe localStorage (e evita divergir na hidratação). */
  function carregar() {
    if (carregado) return;
    carregado = true;
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? '{}');
      // formato antigo: só os itens por galeria
      porGaleria.value = salvo.itens ?? salvo;
      // as regras que a galeria aberta já definiu valem mais que as salvas
      regras.value = { ...salvo.regras, ...regras.value };
    } catch {
      porGaleria.value = {};
    }
    watch(
      [porGaleria, regras],
      ([itens, r]) => {
        try {
          localStorage.setItem(CHAVE, JSON.stringify({ itens, regras: r }));
        } catch {
          // modo privado / armazenamento cheio: o carrinho só não sobrevive ao F5
        }
      },
      { deep: true },
    );
  }

  const itens = (galeriaId: string) => porGaleria.value[galeriaId] ?? [];
  const tem = (galeriaId: string, fotoId: string) =>
    itens(galeriaId).some((i) => i.fotoId === fotoId);
  /** avulso: soma dos preços · pacote: só as que passam do incluído, pelo preço da extra */
  const totalCentavos = (galeriaId: string) => {
    const r = regras.value[galeriaId];
    if (r) return Math.max(0, itens(galeriaId).length - r.restantes) * r.extraCentavos;
    return itens(galeriaId).reduce((soma, i) => soma + i.precoCentavos, 0);
  };
  function definirRegras(galeriaId: string, r: { restantes: number; extraCentavos: number } | null) {
    if (r) regras.value[galeriaId] = r;
    else delete regras.value[galeriaId];
  }

  function alternar(galeriaId: string, foto: FotoPublica) {
    const lista = itens(galeriaId);
    porGaleria.value[galeriaId] = tem(galeriaId, foto.id)
      ? lista.filter((i) => i.fotoId !== foto.id)
      : [
          ...lista,
          { fotoId: foto.id, url: foto.url, numero: foto.numero, precoCentavos: foto.precoCentavos ?? 0 },
        ];
  }

  function limpar(galeriaId: string) {
    delete porGaleria.value[galeriaId];
  }

  return { porGaleria, regras, carregar, itens, tem, totalCentavos, definirRegras, alternar, limpar };
});
