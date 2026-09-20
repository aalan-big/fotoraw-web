import { HttpStatus, Injectable } from '@nestjs/common';
import { DominioExcecao, NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { EmailJaCadastradoExcecao, SenhaFracaExcecao } from '../auth/auth.excecoes.js';
import { AuthService, type Contexto } from '../auth/auth.service.js';
import { SenhaService } from '../auth/senha/senha.service.js';
import { ehSenhaComum } from '../auth/senha/senhas-comuns.js';
import type { CriarAdminDto, StatusAdminDto } from './dto/admins.dto.js';

export class ProprioAdminExcecao extends DominioExcecao {
  constructor() {
    super('PROPRIO_ADMIN', 'Você não pode fazer isso na sua própria conta', HttpStatus.CONFLICT);
  }
}

const RESUMO = {
  id: true,
  nome: true,
  email: true,
  status: true,
  totpAtivadoEm: true,
  criadoEm: true,
} as const;

/**
 * Os administradores da plataforma. Hoje é um (o dono); a tela existe pra quando
 * houver alguém de confiança. Ninguém mexe na própria conta por aqui — evita se
 * trancar pra fora.
 */
@Injectable()
export class AdminsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly senha: SenhaService,
    private readonly auth: AuthService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar() {
    const admins = await this.prisma.conta.findMany({
      where: { papel: 'ADMIN', excluidoEm: null },
      orderBy: { criadoEm: 'asc' },
      select: {
        ...RESUMO,
        sessoesWeb: { orderBy: { criadoEm: 'desc' }, take: 1, select: { criadoEm: true } },
      },
    });
    return admins.map(({ sessoesWeb, totpAtivadoEm, ...a }) => ({
      ...a,
      totpAtivo: totpAtivadoEm !== null,
      ultimoLoginEm: sessoesWeb[0]?.criadoEm ?? null,
    }));
  }

  async criar(admin: Conta, dto: CriarAdminDto, ctx: Contexto) {
    if (ehSenhaComum(dto.senha)) throw new SenhaFracaExcecao();
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.conta.findUnique({ where: { email } })) {
      throw new EmailJaCadastradoExcecao();
    }
    const novo = await this.prisma.conta.create({
      data: {
        nome: dto.nome,
        email,
        senhaHash: await this.senha.hash(dto.senha),
        slug: await this.slugLivre(email),
        papel: 'ADMIN',
        emailVerificadoEm: new Date(),
      },
      select: RESUMO,
    });
    await this.auditoria.registrar({
      acao: 'admin.criado',
      alvoTipo: 'conta',
      alvoId: novo.id,
      atorContaId: admin.id,
      ip: ctx.ip,
      depois: { nome: novo.nome, email: novo.email },
    });
    return { ...novo, totpAtivo: false, ultimoLoginEm: null };
  }

  /** BLOQUEADA derruba sessões na hora; ATIVA libera de novo. */
  async alterarStatus(admin: Conta, id: string, dto: StatusAdminDto, ctx: Contexto) {
    if (id === admin.id) throw new ProprioAdminExcecao();
    const alvo = await this.prisma.conta.findFirst({ where: { id, papel: 'ADMIN' } });
    if (!alvo) throw new NaoEncontradoExcecao('Admin', id);
    if (alvo.status === dto.status) return { alterado: false };
    await this.prisma.conta.update({ where: { id }, data: { status: dto.status } });
    let revogadas = 0;
    if (dto.status === 'BLOQUEADA') revogadas = (await this.auth.revogarTudo(id)).sessoes;
    await this.auditoria.registrar({
      acao: dto.status === 'BLOQUEADA' ? 'admin.bloqueado' : 'admin.reativado',
      alvoTipo: 'conta',
      alvoId: id,
      atorContaId: admin.id,
      ip: ctx.ip,
      antes: { status: alvo.status },
      depois: { status: dto.status, motivo: dto.motivo, sessoesRevogadas: revogadas },
    });
    return { alterado: true };
  }

  /** Outro admin perdeu o celular: zera o 2FA dele (ele reconfigura no próximo login). */
  async zerar2fa(admin: Conta, id: string, motivo: string, ctx: Contexto) {
    if (id === admin.id) throw new ProprioAdminExcecao();
    const alvo = await this.prisma.conta.findFirst({ where: { id, papel: 'ADMIN' } });
    if (!alvo) throw new NaoEncontradoExcecao('Admin', id);
    await this.prisma.conta.update({
      where: { id },
      data: { totpSegredo: null, totpAtivadoEm: null, codigosRecuperacao: [] },
    });
    await this.auth.revogarTudo(id);
    await this.auditoria.registrar({
      acao: '2fa.zerado_pelo_admin',
      alvoTipo: 'conta',
      alvoId: id,
      atorContaId: admin.id,
      ip: ctx.ip,
      depois: { motivo },
    });
  }

  private async slugLivre(email: string): Promise<string> {
    const base = `admin-${email.split('@')[0]!.replace(/[^a-z0-9]+/g, '-')}`.slice(0, 40);
    let slug = base;
    for (let n = 2; await this.prisma.conta.findUnique({ where: { slug } }); n++) {
      slug = `${base}-${n}`;
    }
    return slug;
  }
}
