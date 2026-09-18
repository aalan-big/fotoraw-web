import { Injectable } from '@nestjs/common';
import type { Licenca, Plano, Prisma } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';

@Injectable()
export class LicencasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  planoPorCodigo(codigo: string): Promise<Plano | null> {
    return this.prisma.plano.findUnique({ where: { codigo } });
  }

  /** Valor de `configuracoes_plataforma`; `padrao` se a chave não existir. */
  async configuracao<T>(chave: string, padrao: T): Promise<T> {
    const linha = await this.prisma.configuracaoPlataforma.findUnique({ where: { chave } });
    return linha ? (linha.valor as T) : padrao;
  }

  /** A licença ATIVA mais recente da conta (pode estar vencida — quem decide é o service). */
  ativaMaisRecente(contaId: string): Promise<Licenca | null> {
    return this.prisma.licenca.findFirst({
      where: { contaId, status: 'ATIVA' },
      orderBy: { emitidaEm: 'desc' },
    });
  }

  jaTeveTrial(contaId: string): Promise<boolean> {
    return this.prisma.licenca.count({ where: { contaId, tipo: 'TRIAL' } }).then((n) => n > 0);
  }

  emitir(dados: Prisma.LicencaUncheckedCreateInput): Promise<Licenca> {
    return this.prisma.licenca.create({ data: dados });
  }

  marcarExpirada(id: string): Promise<Licenca> {
    return this.prisma.licenca.update({ where: { id }, data: { status: 'EXPIRADA' } });
  }
}
