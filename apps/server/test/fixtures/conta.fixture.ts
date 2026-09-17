import type { Prisma } from '../../src/infra/prisma/gerado/client.js';

let contador = 0;

/** Dados válidos de uma conta; sobrescreva só o que o teste precisa. */
export function contaFixture(
  sobrescrever: Partial<Prisma.ContaCreateInput> = {},
): Prisma.ContaCreateInput {
  contador += 1;
  return {
    nome: `Estúdio ${contador}`,
    slug: `estudio-${contador}`,
    email: `estudio${contador}@teste.local`,
    senhaHash: 'hash-de-teste',
    ...sobrescrever,
  };
}
