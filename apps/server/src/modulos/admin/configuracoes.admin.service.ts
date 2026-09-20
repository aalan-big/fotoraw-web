import { BadRequestException, Injectable } from '@nestjs/common';
import { NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Contexto } from '../auth/auth.service.js';
import { CATALOGO_CONFIGURACOES, definicaoDaChave } from './configuracoes.catalogo.js';

export interface ConfiguracaoAdmin {
  chave: string;
  grupo: string;
  rotulo: string;
  descricao: string;
  tipo: 'inteiro' | 'percentual' | 'email';
  valor: number | string;
  padrao: number | string;
  atualizadoEm: Date | null;
}

/** Ajustes da plataforma sem deploy. Chave sem linha no banco aparece com o padrão. */
@Injectable()
export class ConfiguracoesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<ConfiguracaoAdmin[]> {
    const linhas = await this.prisma.configuracaoPlataforma.findMany();
    const porChave = new Map(linhas.map((l) => [l.chave, l]));
    return CATALOGO_CONFIGURACOES.map((def) => {
      const linha = porChave.get(def.chave);
      const lido = linha ? def.schema.safeParse(linha.valor) : null;
      return {
        chave: def.chave,
        grupo: def.grupo,
        rotulo: def.rotulo,
        descricao: def.descricao,
        tipo: def.tipo,
        valor: lido?.success ? lido.data : def.padrao,
        padrao: def.padrao,
        atualizadoEm: linha?.atualizadoEm ?? null,
      };
    });
  }

  async alterar(admin: Conta, chave: string, valor: unknown, ctx: Contexto) {
    const def = definicaoDaChave(chave);
    if (!def) throw new NaoEncontradoExcecao('Configuração', chave);
    const r = def.schema.safeParse(valor);
    if (!r.success) {
      throw new BadRequestException({
        mensagem: 'Dados inválidos',
        erros: r.error.issues.map((i) => ({ campo: 'valor', mensagem: i.message })),
      });
    }

    const antes = await this.prisma.configuracaoPlataforma.findUnique({ where: { chave } });
    const depois = await this.prisma.configuracaoPlataforma.upsert({
      where: { chave },
      create: { chave, valor: r.data },
      update: { valor: r.data },
    });
    await this.auditoria.registrar({
      acao: 'config.alterar',
      alvoTipo: 'configuracao',
      alvoId: chave,
      atorContaId: admin.id,
      ip: ctx.ip,
      antes: { valor: antes?.valor ?? null },
      depois: { valor: r.data },
    });
    return { chave, valor: r.data, atualizadoEm: depois.atualizadoEm };
  }
}
