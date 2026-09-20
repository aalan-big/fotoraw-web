import { Injectable } from '@nestjs/common';
import type { Conta } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';

/** Só o que o auth precisa de `contas`. O módulo `contas` tem o repositório completo. */
@Injectable()
export class ContasAuthRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  porEmail(email: string): Promise<Conta | null> {
    return this.prisma.conta.findFirst({ where: { email, excluidoEm: null } });
  }

  porId(id: string): Promise<Conta | null> {
    return this.prisma.conta.findFirst({ where: { id, excluidoEm: null } });
  }

  existeEmailOuSlug(email: string, slug: string): Promise<{ email: string; slug: string } | null> {
    return this.prisma.conta.findFirst({
      where: { OR: [{ email }, { slug }] },
      select: { email: true, slug: true },
    });
  }

  /** Cria conta + perfil (1:1) — o perfil nasce com o nome da conta até o desktop sincronizar. */
  criar(dados: { nome: string; email: string; senhaHash: string; slug: string }): Promise<Conta> {
    return this.prisma.conta.create({
      data: { ...dados, perfil: { create: { nomeFantasia: dados.nome } } },
    });
  }

  marcarEmailVerificado(id: string): Promise<Conta> {
    return this.prisma.conta.update({ where: { id }, data: { emailVerificadoEm: new Date() } });
  }

  /** Remove um código de recuperação já usado (hash). */
  consumirCodigoRecuperacao(id: string, restantes: string[]): Promise<Conta> {
    return this.prisma.conta.update({ where: { id }, data: { codigosRecuperacao: restantes } });
  }

  atualizarSenha(id: string, senhaHash: string): Promise<Conta> {
    return this.prisma.conta.update({ where: { id }, data: { senhaHash } });
  }

  atualizarEmail(id: string, email: string): Promise<Conta> {
    return this.prisma.conta.update({
      where: { id },
      data: { email, emailVerificadoEm: new Date() },
    });
  }
}
