import type { Prisma } from '../../src/infra/prisma/gerado/client.js';

let contador = 0;

/** Galeria de evento (avulso) ligada a uma conta existente. */
export function galeriaEventoFixture(
  contaId: string,
  sobrescrever: Partial<Prisma.GaleriaUncheckedCreateInput> = {},
): Prisma.GaleriaUncheckedCreateInput {
  contador += 1;
  return {
    contaId,
    ensaioIdDesktop: `ensaio-${contador}`,
    titulo: `Corrida ${contador}`,
    slug: `corrida-${contador}`,
    modalidade: 'EVENTO',
    visibilidade: 'PUBLICA',
    categoria: 'CORRIDA_RUA',
    modoVenda: 'AVULSO',
    status: 'PUBLICADA',
    precoFotoCentavos: 1500,
    publicadaEm: new Date(),
    ...sobrescrever,
  };
}

export function fotoFixture(
  galeriaId: string,
  sobrescrever: Partial<Prisma.FotoUncheckedCreateInput> = {},
): Prisma.FotoUncheckedCreateInput {
  contador += 1;
  return {
    galeriaId,
    fotoIdDesktop: `foto-${contador}`,
    previewKey: `previews/foto-${contador}.jpg`,
    altaKey: `originais/foto-${contador}.jpg`,
    numeroIdentificacao: String(1000 + contador),
    ordem: contador,
    ...sobrescrever,
  };
}
