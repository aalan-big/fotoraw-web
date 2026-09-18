import { Injectable } from '@nestjs/common';
import type { SessaoWeb } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';

@Injectable()
export class SessoesWebRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  criar(dados: {
    contaId: string;
    familia: string;
    tokenHash: string;
    expiraEm: Date;
    userAgent?: string | null;
    ip?: string | null;
  }): Promise<SessaoWeb> {
    return this.prisma.sessaoWeb.create({ data: dados });
  }

  porTokenHash(tokenHash: string): Promise<SessaoWeb | null> {
    return this.prisma.sessaoWeb.findUnique({ where: { tokenHash } });
  }

  marcarUsada(id: string): Promise<SessaoWeb> {
    return this.prisma.sessaoWeb.update({ where: { id }, data: { usadaEm: new Date() } });
  }

  revogar(id: string): Promise<SessaoWeb> {
    return this.prisma.sessaoWeb.update({ where: { id }, data: { revogadaEm: new Date() } });
  }

  async revogarFamilia(familia: string): Promise<number> {
    const r = await this.prisma.sessaoWeb.updateMany({
      where: { familia, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
    return r.count;
  }

  async revogarTodasDaConta(contaId: string): Promise<number> {
    const r = await this.prisma.sessaoWeb.updateMany({
      where: { contaId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
    return r.count;
  }
}
