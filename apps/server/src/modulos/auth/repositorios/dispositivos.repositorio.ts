import { Injectable } from '@nestjs/common';
import type { Dispositivo, TokenApi } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import type { RecursosLicenca } from '../../licencas/recursos-licenca.js';

/** token_api que ainda vale: não revogado e não vencido (função: a data é a de agora, não a da subida). */
const tokenVivo = () => ({
  revogadoEm: null,
  OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
});

/** Dispositivos e os tokens_api que eles usam — tudo do lado do desktop. */
@Injectable()
export class DispositivosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  /** Máquinas que ocupam vaga na licença = as que têm um token vivo. Revogada libera a vaga. */
  contarConectados(contaId: string): Promise<number> {
    return this.prisma.dispositivo.count({ where: { contaId, tokensApi: { some: tokenVivo() } } });
  }

  /** O dispositivo e se ele ainda tem token vivo (reconexão não conta como máquina nova). */
  async porFingerprint(
    contaId: string,
    fingerprint: string,
  ): Promise<{ dispositivo: Dispositivo; conectado: boolean } | null> {
    const d = await this.prisma.dispositivo.findUnique({
      where: { contaId_fingerprint: { contaId, fingerprint } },
      include: { _count: { select: { tokensApi: { where: tokenVivo() } } } },
    });
    if (!d) return null;
    const { _count, ...dispositivo } = d;
    return { dispositivo, conectado: _count.tokensApi > 0 };
  }

  listarDaConta(contaId: string) {
    return this.prisma.dispositivo.findMany({
      where: { contaId },
      orderBy: { ultimoVistoEm: 'desc' },
      include: {
        tokensApi: {
          where: tokenVivo(),
          orderBy: { criadoEm: 'desc' },
          take: 1,
          select: { ultimoUsoEm: true, expiraEm: true },
        },
      },
    });
  }

  porIdDaConta(contaId: string, id: string): Promise<Dispositivo | null> {
    return this.prisma.dispositivo.findFirst({ where: { id, contaId } });
  }

  /** Revogar a máquina = matar os tokens dela. A linha fica (histórico, sync_lotes apontam pro token). */
  async revogarDispositivo(dispositivoId: string): Promise<number> {
    const r = await this.prisma.tokenApi.updateMany({
      where: { dispositivoId, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
    return r.count;
  }

  upsert(dados: {
    contaId: string;
    fingerprint: string;
    nome: string;
    versaoApp?: string | null;
  }): Promise<Dispositivo> {
    const { contaId, fingerprint, nome, versaoApp } = dados;
    return this.prisma.dispositivo.upsert({
      where: { contaId_fingerprint: { contaId, fingerprint } },
      create: { contaId, fingerprint, nome, versaoApp: versaoApp ?? null },
      update: { nome, versaoApp: versaoApp ?? null, ultimoVistoEm: new Date() },
    });
  }

  /** Novo login na mesma máquina: o token anterior dela morre, nasce outro. */
  trocarTokenDoDispositivo(dados: {
    contaId: string;
    dispositivoId: string;
    nome: string;
    tokenHash: string;
    expiraEm: Date;
  }): Promise<TokenApi> {
    const { contaId, dispositivoId, nome, tokenHash, expiraEm } = dados;
    return this.prisma.$transaction(async (tx) => {
      await tx.tokenApi.updateMany({
        where: { dispositivoId, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
      return tx.tokenApi.create({ data: { contaId, dispositivoId, nome, tokenHash, expiraEm } });
    });
  }

  tokenPorHash(
    tokenHash: string,
  ): Promise<(TokenApi & { dispositivo: Dispositivo | null }) | null> {
    return this.prisma.tokenApi.findUnique({
      where: { tokenHash },
      include: { dispositivo: true },
    });
  }

  /** Marca uso e, opcionalmente, empurra a validade (renovação silenciosa). */
  registrarUso(id: string, novaExpiracao?: Date): Promise<TokenApi> {
    return this.prisma.tokenApi.update({
      where: { id },
      data: { ultimoUsoEm: new Date(), ...(novaExpiracao ? { expiraEm: novaExpiracao } : {}) },
    });
  }

  async revogarTodosDaConta(contaId: string): Promise<number> {
    const r = await this.prisma.tokenApi.updateMany({
      where: { contaId, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
    return r.count;
  }

  /** Limite de máquinas vem do snapshot `recursos` da licença ativa; sem licença = sem limite. */
  async limiteDispositivos(contaId: string): Promise<number | null> {
    const licenca = await this.prisma.licenca.findFirst({
      where: {
        contaId,
        status: 'ATIVA',
        OR: [{ validaAte: null }, { validaAte: { gt: new Date() } }],
      },
      orderBy: { emitidaEm: 'desc' },
      select: { recursos: true },
    });
    const recursos = licenca?.recursos as Partial<RecursosLicenca> | undefined;
    return recursos?.limite_dispositivos ?? null;
  }
}
