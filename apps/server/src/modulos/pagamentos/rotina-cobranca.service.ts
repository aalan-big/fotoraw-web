import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CobrancaAssinaturasService } from './cobranca-assinaturas.service.js';
import { inicioDoDia } from './periodo.js';

const INTERVALO_24H_MS = 24 * 60 * 60 * 1000;
const DELAY_INICIAL_BOOT_MS = 30 * 1000; // 30s após o boot para não onerar o startup

/**
 * Rotina diária de cobrança do servidor:
 * - Roda automaticamente em segundo plano a cada 24 horas.
 * - Marca faturas pendentes vencidas como VENCIDA e assinatura como INADIMPLENTE.
 * - Dispara os e-mails para o fotógrafo ("vence em 3 dias" e "plano vencido").
 * - Não bloqueia requisições HTTP e não depende de o admin abrir o painel.
 */
@Injectable()
export class RotinaCobrancaService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RotinaCobrancaService.name);
  private timer: NodeJS.Timeout | null = null;
  private delayInicial: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cobranca: CobrancaAssinaturasService,
  ) {}

  onApplicationBootstrap() {
    // Agenda primeira execução logo após o boot da aplicação
    this.delayInicial = setTimeout(() => {
      void this.executarRotina();
      // Em seguida, repete a cada 24 horas
      this.timer = setInterval(() => {
        void this.executarRotina();
      }, INTERVALO_24H_MS);
    }, DELAY_INICIAL_BOOT_MS);

    this.logger.log('Rotina diária de cobrança agendada (a cada 24h)');
  }

  onApplicationShutdown() {
    if (this.delayInicial) clearTimeout(this.delayInicial);
    if (this.timer) clearInterval(this.timer);
    this.logger.log('Rotina de cobrança encerrada');
  }

  /**
   * Executa a rotina diária com proteção contra erros não capturados.
   */
  async executarRotina(): Promise<{ faturasVencidas: number; avisos3Dias: number; avisosVencidos: number }> {
    try {
      this.logger.log('Iniciando checagem diária de cobrança e vencimentos...');

      // 1. Marca faturas vencidas no banco
      const faturasVencidas = await this.marcarFaturasVencidas();

      // 2. Dispara os e-mails devidos para os fotógrafos
      const { avisos3Dias, avisosVencidos } = await this.cobranca.verificarAvisosVencimento();

      this.logger.log(
        `Rotina de cobrança concluída: ${faturasVencidas} faturas marcadas vencidas, ` +
        `${avisos3Dias} avisos de 3 dias enviados, ${avisosVencidos} avisos de vencido enviados.`,
      );

      return { faturasVencidas, avisos3Dias, avisosVencidos };
    } catch (erro) {
      this.logger.error(
        'Falha ao executar rotina diária de cobrança',
        erro instanceof Error ? erro.stack : String(erro),
      );
      return { faturasVencidas: 0, avisos3Dias: 0, avisosVencidos: 0 };
    }
  }

  private async marcarFaturasVencidas(): Promise<number> {
    const hoje = inicioDoDia(new Date(), true);
    const vencidas = await this.prisma.fatura.findMany({
      where: {
        status: 'PENDENTE',
        vencimento: { lt: hoje },
      },
      select: { id: true, assinaturaId: true },
    });

    if (!vencidas.length) return 0;

    await this.prisma.$transaction([
      this.prisma.fatura.updateMany({
        where: { id: { in: vencidas.map((f) => f.id) } },
        data: { status: 'VENCIDA' },
      }),
      this.prisma.assinatura.updateMany({
        where: { id: { in: vencidas.map((f) => f.assinaturaId) }, status: 'ATIVA' },
        data: { status: 'INADIMPLENTE' },
      }),
    ]);

    return vencidas.length;
  }
}
