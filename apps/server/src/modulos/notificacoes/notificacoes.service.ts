import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

export interface AvisoPush {
  titulo: string;
  corpo: string;
  /** caminho no admin aberto ao tocar na notificação */
  url?: string;
}

export interface InscricaoNavegador {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Notificação no celular do admin (Web Push, igual ao SeuPercurso): o admin ativa no
 * aparelho, o navegador dá um endpoint, a gente guarda e manda os avisos pra ele.
 * Sem chaves VAPID no .env fica desligado. Nunca lança: aviso perdido não pode
 * derrubar o webhook de pagamento.
 */
@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);
  readonly chavePublica: string;
  private readonly ligado: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.chavePublica = config.get('VAPID_PUBLIC_KEY');
    const privada = config.get('VAPID_PRIVATE_KEY');
    this.ligado = false;
    if (this.chavePublica && privada) {
      try {
        webpush.setVapidDetails(config.get('VAPID_SUBJECT'), this.chavePublica, privada);
        this.ligado = true;
      } catch (erro) {
        this.logger.error(`chaves VAPID inválidas: ${erro instanceof Error ? erro.message : erro}`);
      }
    }
  }

  get ativo(): boolean {
    return this.ligado;
  }

  async inscrever(contaId: string, inscricao: InscricaoNavegador, userAgent?: string) {
    const dados = {
      contaId,
      p256dh: inscricao.keys.p256dh,
      auth: inscricao.keys.auth,
      userAgent: userAgent?.slice(0, 300) ?? null,
    };
    await this.prisma.inscricaoPush.upsert({
      where: { endpoint: inscricao.endpoint },
      create: { endpoint: inscricao.endpoint, ...dados },
      update: dados,
    });
  }

  async cancelar(contaId: string, endpoint: string) {
    await this.prisma.inscricaoPush.deleteMany({ where: { contaId, endpoint } });
  }

  aparelhos(contaId: string) {
    return this.prisma.inscricaoPush.count({ where: { contaId } });
  }

  /** Manda pra todos os aparelhos de admin. Aparelho que sumiu (404/410) sai da lista. */
  async avisarAdmins(aviso: AvisoPush, soContaId?: string): Promise<number> {
    if (!this.ligado) return 0;
    try {
      const inscricoes = await this.prisma.inscricaoPush.findMany({
        where: soContaId ? { contaId: soContaId } : { conta: { papel: 'ADMIN' } },
      });
      const carga = JSON.stringify({ title: aviso.titulo, body: aviso.corpo, url: aviso.url ?? '/' });
      let entregues = 0;
      await Promise.all(
        inscricoes.map(async (i) => {
          try {
            await webpush.sendNotification(
              { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
              carga,
              { TTL: 86_400, urgency: 'high' },
            );
            entregues++;
          } catch (erro) {
            const status = (erro as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await this.prisma.inscricaoPush.deleteMany({ where: { id: i.id } });
            } else {
              this.logger.warn(`push não entregue (${status ?? '?'}): ${(erro as Error).message}`);
            }
          }
        }),
      );
      return entregues;
    } catch (erro) {
      this.logger.error(`falha ao enviar push: ${erro instanceof Error ? erro.message : erro}`);
      return 0;
    }
  }
}
