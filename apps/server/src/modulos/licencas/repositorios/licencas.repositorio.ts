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

  porId(id: string): Promise<Licenca | null> {
    return this.prisma.licenca.findUnique({ where: { id } });
  }

  planoPorId(id: string): Promise<Plano | null> {
    return this.prisma.plano.findUnique({ where: { id } });
  }

  historico(contaId: string): Promise<Licenca[]> {
    return this.prisma.licenca.findMany({ where: { contaId }, orderBy: { emitidaEm: 'desc' } });
  }

  /**
   * Emite substituindo: as ativas da conta viram REVOGADA na mesma transação
   * (uma ativa por conta — regra do modelo, garantida aqui e não por índice).
   */
  emitirSubstituindo(
    dados: Prisma.LicencaUncheckedCreateInput,
    motivoRevogacao: string,
  ): Promise<{ nova: Licenca; revogadas: number }> {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.licenca.updateMany({
        where: { contaId: dados.contaId, status: 'ATIVA' },
        data: { status: 'REVOGADA', motivo: motivoRevogacao },
      });
      const nova = await tx.licenca.create({ data: dados });
      return { nova, revogadas: r.count };
    });
  }

  alterarStatus(id: string, status: Licenca['status'], motivo?: string): Promise<Licenca> {
    return this.prisma.licenca.update({
      where: { id },
      data: { status, ...(motivo ? { motivo } : {}) },
    });
  }

  /** Licenças ATIVAS emitidas a partir de um plano (via assinatura ou motivo "plano:<codigo>"). */
  ativasDoPlano(planoId: string): Promise<Licenca[]> {
    return this.prisma.licenca.findMany({
      where: {
        status: 'ATIVA',
        OR: [{ assinatura: { planoId } }, { motivo: { startsWith: `plano:${planoId}` } }],
      },
    });
  }

  ativaDaAssinatura(assinaturaId: string): Promise<Licenca | null> {
    return this.prisma.licenca.findFirst({ where: { assinaturaId, status: 'ATIVA' } });
  }

  estenderValidade(id: string, validaAte: Date, recursos: Prisma.InputJsonValue): Promise<Licenca> {
    return this.prisma.licenca.update({ where: { id }, data: { validaAte, recursos } });
  }

  /** Troca o snapshot `recursos` de várias licenças de uma vez (reemissão pelo plano). */
  atualizarRecursos(ids: string[], recursos: Prisma.InputJsonValue): Promise<number> {
    if (ids.length === 0) return Promise.resolve(0);
    return this.prisma.licenca
      .updateMany({ where: { id: { in: ids } }, data: { recursos } })
      .then((r) => r.count);
  }

  listar(filtro: {
    tipo?: Licenca['tipo'];
    status?: Licenca['status'];
    venceAte?: Date;
    pagina: number;
    porPagina: number;
  }) {
    const where: Prisma.LicencaWhereInput = {
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtro.status ? { status: filtro.status } : {}),
      ...(filtro.venceAte ? { validaAte: { lte: filtro.venceAte, gte: new Date() } } : {}),
    };
    return this.prisma.$transaction([
      this.prisma.licenca.findMany({
        where,
        orderBy: { emitidaEm: 'desc' },
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
        include: {
          conta: { select: { id: true, nome: true, email: true, slug: true, status: true } },
        },
      }),
      this.prisma.licenca.count({ where }),
    ]);
  }
}
