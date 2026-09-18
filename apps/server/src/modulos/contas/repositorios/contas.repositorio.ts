import { Injectable } from '@nestjs/common';
import type { Conta, Perfil, Prisma } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';

@Injectable()
export class ContasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  perfil(contaId: string): Promise<Perfil | null> {
    return this.prisma.perfil.findUnique({ where: { contaId } });
  }

  /** O perfil nasce no cadastro, mas o upsert cobre contas antigas do seed. */
  salvarPerfil(
    contaId: string,
    nomePadrao: string,
    dados: Omit<Prisma.PerfilUncheckedCreateInput, 'contaId' | 'nomeFantasia'> & {
      nomeFantasia?: string;
    },
  ): Promise<Perfil> {
    const { nomeFantasia, ...resto } = dados;
    return this.prisma.perfil.upsert({
      where: { contaId },
      update: { ...resto, ...(nomeFantasia !== undefined ? { nomeFantasia } : {}) },
      create: { ...resto, contaId, nomeFantasia: nomeFantasia ?? nomePadrao },
    });
  }

  atualizarNome(id: string, nome: string): Promise<Conta> {
    return this.prisma.conta.update({ where: { id }, data: { nome } });
  }

  /**
   * Exclusão lógica: marca `excluido_em`, libera o e-mail (pra poder cadastrar de novo)
   * e mantém a linha — pedidos, repasses e auditoria continuam apontando pra ela.
   */
  excluir(id: string): Promise<Conta> {
    return this.prisma.conta.update({
      where: { id },
      data: {
        excluidoEm: new Date(),
        email: `excluida+${id}@fotoraw.invalid`,
        status: 'BLOQUEADA',
      },
    });
  }
}
