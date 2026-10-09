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

  /**
   * Assinatura pedida pelo painel enquanto não há cobrança automática: nasce com a 1ª fatura
   * PENDENTE e SEM licença. O PRO só é liberado quando a fatura é paga (admin → marcar paga;
   * depois, o webhook do Mercado Pago). Pedido anterior ainda não pago é substituído.
   */
  async criarAssinaturaAguardandoPagamento(contaId: string, plano: Plano) {
    const agora = new Date();
    return this.prisma.$transaction(async (tx) => {
      const naoPagas = await tx.assinatura.findMany({
        where: {
          contaId,
          status: { in: ['TRIAL', 'ATIVA', 'INADIMPLENTE'] },
          faturas: { none: { status: 'PAGA' } },
        },
        select: { id: true },
      });
      for (const { id } of naoPagas) {
        await tx.assinatura.update({
          where: { id },
          data: {
            status: 'CANCELADA',
            canceladaEm: agora,
            observacaoAdmin: `Pedido substituído pelo plano ${plano.codigo} antes do pagamento`,
          },
        });
        await tx.fatura.updateMany({
          where: { assinaturaId: id, status: { in: ['PENDENTE', 'VENCIDA'] } },
          data: { status: 'CANCELADA' },
        });
      }
      return tx.assinatura.create({
        data: {
          contaId,
          planoId: plano.id,
          status: 'ATIVA',
          inicioEm: agora,
          periodoAtualInicio: agora,
          periodoAtualFim: somarPeriodo(agora, plano.periodicidade),
          provedor: 'MANUAL',
          origem: 'SITE',
          observacaoAdmin: 'Pedido pelo painel — aguardando pagamento',
          faturas: { create: { valorCentavos: plano.precoCentavos, vencimento: agora } },
        },
      });
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
