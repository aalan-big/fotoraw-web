import { Injectable } from '@nestjs/common';
import type { Assinatura, Fatura, Periodicidade, Plano } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';

export interface AssinaturaComPlanoEFaturas extends Assinatura {
  plano: Plano;
  faturas: Fatura[];
}

function somarPeriodo(inicio: Date, periodicidade: Periodicidade): Date {
  const data = new Date(inicio.getTime());
  if (periodicidade === 'MENSAL') {
    data.setMonth(data.getMonth() + 1);
  } else if (periodicidade === 'ANUAL') {
    data.setFullYear(data.getFullYear() + 1);
  }
  return data;
}

@Injectable()
export class PlanosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listarPlanosAtivos(): Promise<Plano[]> {
    return this.prisma.plano.findMany({
      where: { ativo: true },
      orderBy: { ordem: 'asc' },
    });
  }

  async planoPorCodigo(codigo: string): Promise<Plano | null> {
    return this.prisma.plano.findUnique({
      where: { codigo },
    });
  }

  async planoPorId(id: string): Promise<Plano | null> {
    return this.prisma.plano.findUnique({
      where: { id },
    });
  }

  async assinaturaAtivaDaConta(contaId: string): Promise<AssinaturaComPlanoEFaturas | null> {
    return this.prisma.assinatura.findFirst({
      where: {
        contaId,
        status: { in: ['TRIAL', 'ATIVA', 'INADIMPLENTE'] },
      },
      orderBy: { criadoEm: 'desc' },
      include: {
        plano: true,
        faturas: {
          orderBy: { vencimento: 'desc' },
        },
      },
    });
  }

  async listarFaturasDaConta(contaId: string): Promise<Fatura[]> {
    return this.prisma.fatura.findMany({
      where: {
        assinatura: { contaId },
      },
      orderBy: { vencimento: 'desc' },
    });
  }

  async criarOuRenovarAssinatura(dados: {
    contaId: string;
    plano: Plano;
    origem: 'SITE' | 'ADMIN';
    provedor: 'MANUAL' | 'STRIPE';
    observacao?: string;
  }): Promise<AssinaturaComPlanoEFaturas> {
    const agora = new Date();
    const fim = somarPeriodo(agora, dados.plano.periodicidade);

    return this.prisma.$transaction(async (tx) => {
      // 1. Encerra qualquer assinatura anterior em aberto
      const ativasAnteriores = await tx.assinatura.findMany({
        where: {
          contaId: dados.contaId,
          status: { in: ['TRIAL', 'ATIVA', 'INADIMPLENTE'] },
        },
      });

      for (const antiga of ativasAnteriores) {
        await tx.assinatura.update({
          where: { id: antiga.id },
          data: {
            status: 'CANCELADA',
            canceladaEm: agora,
            observacaoAdmin: `Substituída por nova assinatura do plano ${dados.plano.codigo}`,
          },
        });
        await tx.fatura.updateMany({
          where: {
            assinaturaId: antiga.id,
            status: { in: ['PENDENTE', 'VENCIDA'] },
          },
          data: { status: 'CANCELADA' },
        });
      }

      // 2. Cria a nova assinatura
      const nova = await tx.assinatura.create({
        data: {
          contaId: dados.contaId,
          planoId: dados.plano.id,
          status: 'ATIVA',
          inicioEm: agora,
          periodoAtualInicio: agora,
          periodoAtualFim: fim,
          provedor: dados.provedor,
          origem: dados.origem,
          observacaoAdmin: dados.observacao ?? null,
          faturas: {
            create: [
              {
                valorCentavos: dados.plano.precoCentavos,
                vencimento: agora,
                status: 'PAGA',
                pagaEm: agora,
              },
              {
                valorCentavos: dados.plano.precoCentavos,
                vencimento: fim,
                status: 'PENDENTE',
              },
            ],
          },
        },
        include: {
          plano: true,
          faturas: {
            orderBy: { vencimento: 'desc' },
          },
        },
      });

      return nova;
    });
  }

  async cancelarNoFimDoPeriodo(assinaturaId: string, motivo?: string): Promise<Assinatura> {
    return this.prisma.$transaction(async (tx) => {
      // Cancela faturas futuras que estejam pendentes
      await tx.fatura.updateMany({
        where: {
          assinaturaId,
          status: { in: ['PENDENTE', 'VENCIDA'] },
        },
        data: { status: 'CANCELADA' },
      });

      return tx.assinatura.update({
        where: { id: assinaturaId },
        data: {
          cancelaNoFimDoPeriodo: true,
          observacaoAdmin: motivo ? `Cancelamento agendado: ${motivo}` : undefined,
        },
      });
    });
  }

  async reativarAssinatura(
    assinatura: AssinaturaComPlanoEFaturas,
  ): Promise<Assinatura> {
    return this.prisma.$transaction(async (tx) => {
      // Recria fatura futura se não houver
      const existePendente = await tx.fatura.findFirst({
        where: {
          assinaturaId: assinatura.id,
          status: 'PENDENTE',
        },
      });

      if (!existePendente && assinatura.plano.precoCentavos > 0) {
        await tx.fatura.create({
          data: {
            assinaturaId: assinatura.id,
            valorCentavos: assinatura.plano.precoCentavos,
            vencimento: assinatura.periodoAtualFim,
            status: 'PENDENTE',
          },
        });
      }

      return tx.assinatura.update({
        where: { id: assinatura.id },
        data: {
          cancelaNoFimDoPeriodo: false,
        },
      });
    });
  }
}
