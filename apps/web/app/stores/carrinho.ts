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
 * precisa de conta). O pagamento entra na Fase 5 — por enquanto o carrinho
 * só monta a seleção.
 */
export const useCarrinho = defineStore('carrinho', () => {
  const porGaleria = ref<Record<string, ItemCarrinho[]>>({});
  let carregado = false;

  /** Chamar no onMounted: no SSR não existe localStorage (e evita divergir na hidratação). */
  function carregar() {
    if (carregado) return;
    carregado = true;
    try {
      porGaleria.value = JSON.parse(localStorage.getItem(CHAVE) ?? '{}');
    } catch {
      porGaleria.value = {};
    }
    watch(
      porGaleria,
      (v) => {
        try {
          localStorage.setItem(CHAVE, JSON.stringify(v));
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
  const totalCentavos = (galeriaId: string) =>
    itens(galeriaId).reduce((soma, i) => soma + i.precoCentavos, 0);

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

  return { porGaleria, carregar, itens, tem, totalCentavos, alternar, limpar };
});
