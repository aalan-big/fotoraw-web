import { Injectable } from '@nestjs/common';
import type { Provedor } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import type { AtualizarTaxasDto } from '../dto/financeiro.dto.js';

@Injectable()
export class FinanceiroRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async obterConexao(contaId: string, provedor: Provedor = 'MERCADOPAGO') {
    return this.prisma.conexaoPagamento.findFirst({
      where: {
        contaId,
        provedor,
        revogadoEm: null,
      },
    });
  }

  async salvarConexao(dados: {
    contaId: string;
    provedor: Provedor;
    provedorUsuarioId: string;
    accessTokenCifrado: string;
    refreshTokenCifrado?: string | null;
    tokenExpiraEm?: Date | null;
    rotulo?: string | null;
  }) {
    return this.prisma.conexaoPagamento.upsert({
      where: {
        contaId_provedor: {
          contaId: dados.contaId,
          provedor: dados.provedor,
        },
      },
      create: {
        contaId: dados.contaId,
        provedor: dados.provedor,
        provedorUsuarioId: dados.provedorUsuarioId,
        accessTokenCifrado: dados.accessTokenCifrado,
        refreshTokenCifrado: dados.refreshTokenCifrado ?? null,
        tokenExpiraEm: dados.tokenExpiraEm ?? null,
        rotulo: dados.rotulo ?? null,
        revogadoEm: null,
      },
      update: {
        provedorUsuarioId: dados.provedorUsuarioId,
        accessTokenCifrado: dados.accessTokenCifrado,
        refreshTokenCifrado: dados.refreshTokenCifrado ?? null,
        tokenExpiraEm: dados.tokenExpiraEm ?? null,
        rotulo: dados.rotulo ?? null,
        revogadoEm: null,
        conectadoEm: new Date(),
      },
    });
  }

  async revogarConexao(contaId: string, provedor: Provedor = 'MERCADOPAGO') {
    return this.prisma.conexaoPagamento.updateMany({
      where: {
        contaId,
        provedor,
        revogadoEm: null,
      },
      data: {
        revogadoEm: new Date(),
      },
    });
  }

  async listarRepasses(contaId: string) {
    return this.prisma.repasse.findMany({
      where: { contaId },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async obterSaldos(contaId: string) {
    const [pedidosPagos, repassesConcluidos] = await Promise.all([
      this.prisma.pedido.aggregate({
        where: { contaId, status: 'PAGO' },
        _sum: {
          totalCentavos: true,
          repasseCentavos: true,
          comissaoCentavos: true,
        },
        _count: {
          id: true,
        },
      }),
      this.prisma.repasse.aggregate({
        where: { contaId, status: 'PAGO' },
        _sum: {
          valorCentavos: true,
        },
      }),
    ]);

    const totalRepasseCalculado = pedidosPagos._sum.repasseCentavos ?? 0;
    const saldoTotalRepassadoCentavos = repassesConcluidos._sum.valorCentavos ?? 0;
    const saldoDisponivelCentavos = Math.max(0, totalRepasseCalculado - saldoTotalRepassadoCentavos);

    return {
      saldoDisponivelCentavos,
      saldoTotalRepassadoCentavos,
      totalVendasBrutoCentavos: pedidosPagos._sum.totalCentavos ?? 0,
      totalComissaoCentavos: pedidosPagos._sum.comissaoCentavos ?? 0,
      totalPedidosPagos: pedidosPagos._count.id,
    };
  }

  async obterConfiguracaoTaxas(contaId: string) {
    return this.prisma.perfil.findUnique({
      where: { contaId },
      select: {
        taxasParaCliente: true,
        chavePix: true,
        cnpjCpf: true,
      },
    });
  }

  async atualizarTaxas(contaId: string, dados: AtualizarTaxasDto) {
    return this.prisma.perfil.upsert({
      where: { contaId },
      create: {
        contaId,
        nomeFantasia: 'Meu Estúdio',
        taxasParaCliente: dados.taxasParaCliente ?? false,
        chavePix: dados.chavePix ?? null,
        cnpjCpf: dados.cnpjCpf ?? null,
      },
      update: {
        ...(dados.taxasParaCliente !== undefined
          ? { taxasParaCliente: dados.taxasParaCliente }
          : {}),
        ...(dados.chavePix !== undefined ? { chavePix: dados.chavePix } : {}),
        ...(dados.cnpjCpf !== undefined ? { cnpjCpf: dados.cnpjCpf } : {}),
      },
    });
  }
}
