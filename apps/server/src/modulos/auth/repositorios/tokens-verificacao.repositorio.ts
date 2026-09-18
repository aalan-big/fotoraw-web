import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  TipoTokenVerificacao,
  TokenVerificacao,
} from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';

@Injectable()
export class TokensVerificacaoRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  /** Um token vivo por (conta, tipo): emitir de novo invalida o anterior. */
  async emitir(dados: {
    contaId: string;
    tipo: TipoTokenVerificacao;
    tokenHash: string;
    expiraEm: Date;
    dados?: Prisma.InputJsonValue;
  }): Promise<TokenVerificacao> {
    await this.prisma.tokenVerificacao.updateMany({
      where: { contaId: dados.contaId, tipo: dados.tipo, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    return this.prisma.tokenVerificacao.create({ data: dados });
  }

  porTokenHash(tokenHash: string): Promise<TokenVerificacao | null> {
    return this.prisma.tokenVerificacao.findUnique({ where: { tokenHash } });
  }

  marcarUsado(id: string): Promise<TokenVerificacao> {
    return this.prisma.tokenVerificacao.update({ where: { id }, data: { usadoEm: new Date() } });
  }
}
