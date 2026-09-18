import { Injectable } from '@nestjs/common';
import type { Dispositivo, TokenApi } from '../../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import type { RecursosLicenca } from '../../licencas/recursos-licenca.js';

/** Dispositivos e os tokens_api que eles usam — tudo do lado do desktop. */
@Injectable()
export class DispositivosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  contarDaConta(contaId: string): Promise<number> {
    return this.prisma.dispositivo.count({ where: { contaId } });
  }

  porFingerprint(contaId: string, fingerprint: string): Promise<Dispositivo | null> {
    return this.prisma.dispositivo.findUnique({
      where: { contaId_fingerprint: { contaId, fingerprint } },
    });
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
