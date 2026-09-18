import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../prisma/gerado/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface EventoAuditoria {
  /** conta.criada, dispositivo.vinculado, senha.redefinida, sessao.reuso_detectado… */
  acao: string;
  alvoTipo: string;
  alvoId: string;
  /** quem fez (null = ação anônima, ex.: recuperar senha) */
  atorContaId?: string | null;
  ip?: string | null;
  antes?: Prisma.InputJsonValue;
  depois?: Prisma.InputJsonValue;
}

/**
 * Trilha de auditoria (tabela `auditoria`). Nunca lança: perder um registro de
 * auditoria é ruim, derrubar o login por causa disso é pior — o erro vai pro log.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(evento: EventoAuditoria): Promise<void> {
    try {
      await this.prisma.auditoria.create({
        data: {
          acao: evento.acao,
          alvoTipo: evento.alvoTipo,
          alvoId: evento.alvoId,
          atorContaId: evento.atorContaId ?? null,
          ip: evento.ip ?? null,
          antes: evento.antes,
          depois: evento.depois,
        },
      });
    } catch (erro) {
      this.logger.error(
        `Falha ao auditar ${evento.acao}`,
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }
}
