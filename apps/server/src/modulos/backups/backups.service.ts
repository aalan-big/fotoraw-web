import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DominioExcecao, NaoEncontradoExcecao } from '../../comum/excecoes/dominio.excecao.js';
import { AuditoriaService } from '../../infra/auditoria/auditoria.service.js';
import type { Prisma, TokenApi } from '../../infra/prisma/gerado/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import type { IniciarBackupDto } from './dto/backups.dto.js';
import { backupsParaApagar } from './retencao.js';

const LINK_SEGUNDOS = 2 * 60 * 60;
/** upload que não confirmou em 1 dia: desistiu (PC desligou no meio) */
const ABANDONADO_MS = 24 * 60 * 60 * 1000;

export interface BackupResumo {
  id: string;
  criadoEm: Date;
  concluidoEm: Date | null;
  tamanhoBytes: number;
  sha256: string;
  versaoApp: string | null;
  resumo: Prisma.JsonValue;
  /** nome do computador que mandou (null = já removido da conta) */
  computador: string | null;
}

/**
 * Backup do banco do desktop (Etapa 2). O desktop pede um link, sobe o arquivo direto
 * no bucket privado e confirma; aqui só guarda o registro e aplica a retenção.
 * Restaurar = listar + pedir o link de download.
 */
@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async iniciar(contaId: string, tokenApi: TokenApi | undefined, dto: IniciarBackupDto) {
    await this.limparAbandonados(contaId);

    const id = randomUUID();
    const dia = new Date().toISOString().slice(0, 10);
    const chave = `backups/${contaId}/${dia}_${id}.fotoraw-backup`;
    const backup = await this.prisma.backupDesktop.create({
      data: {
        id,
        contaId,
        dispositivoId: tokenApi?.dispositivoId ?? null,
        chave,
        tamanhoBytes: dto.tamanhoBytes,
        sha256: dto.sha256.toLowerCase(),
        versaoApp: dto.versaoApp ?? null,
        resumo: dto.resumo ?? undefined,
      },
    });
    const urlUpload = await this.storage.gerarUrlUpload(
      this.storage.bucketOriginais,
      chave,
      'application/octet-stream',
      LINK_SEGUNDOS,
      dto.tamanhoBytes,
    );
    return {
      id: backup.id,
      urlUpload,
      expiraEm: new Date(Date.now() + LINK_SEGUNDOS * 1000),
    };
  }

  /** Confere no bucket que o arquivo chegou inteiro. Repetir não faz mal. */
  async confirmar(id: string, contaId: string): Promise<BackupResumo> {
    const backup = await this.prisma.backupDesktop.findFirst({
      where: { id, contaId },
      include: { dispositivo: { select: { nome: true } } },
    });
    if (!backup) throw new NaoEncontradoExcecao('Backup');
    if (backup.status === 'CONCLUIDO') return resumir(backup);

    const tamanho = await this.storage.obterTamanhoObjetoBytes(
      this.storage.bucketOriginais,
      backup.chave,
    );
    if (tamanho === null) {
      throw new DominioExcecao('BACKUP_NAO_ENVIADO', 'O arquivo do backup não chegou na nuvem');
    }
    if (tamanho !== backup.tamanhoBytes) {
      throw new DominioExcecao(
        'BACKUP_INCOMPLETO',
        `O backup chegou incompleto (${tamanho} de ${backup.tamanhoBytes} bytes)`,
      );
    }

    const concluido = await this.prisma.backupDesktop.update({
      where: { id },
      data: { status: 'CONCLUIDO', concluidoEm: new Date() },
      include: { dispositivo: { select: { nome: true } } },
    });
    await this.aplicarRetencao(contaId);
    return resumir(concluido);
  }

  async listar(contaId: string): Promise<BackupResumo[]> {
    const lista = await this.prisma.backupDesktop.findMany({
      where: { contaId, status: 'CONCLUIDO' },
      orderBy: { concluidoEm: 'desc' },
      include: { dispositivo: { select: { nome: true } } },
    });
    return lista.map(resumir);
  }

  /** Link de 2 h pro arquivo — o desktop restaura, o painel baixa pra guardar. */
  async linkArquivo(id: string, contaId: string, ip?: string) {
    const backup = await this.prisma.backupDesktop.findFirst({
      where: { id, contaId, status: 'CONCLUIDO' },
    });
    if (!backup) {
      throw new DominioExcecao(
        'BACKUP_NAO_ENCONTRADO',
        'Este backup não existe mais',
        HttpStatus.NOT_FOUND,
      );
    }
    const dia = (backup.concluidoEm ?? backup.criadoEm).toISOString().slice(0, 10);
    const url = await this.storage.gerarUrlDownloadAssinada(
      this.storage.bucketOriginais,
      backup.chave,
      LINK_SEGUNDOS,
      `FotoRAW-backup-${dia}.fotoraw-backup`,
    );
    await this.auditoria.registrar({
      acao: 'backup.baixado',
      alvoTipo: 'backup_desktop',
      alvoId: backup.id,
      atorContaId: contaId,
      ip,
    });
    return {
      url,
      tamanhoBytes: backup.tamanhoBytes,
      sha256: backup.sha256,
      expiraEm: new Date(Date.now() + LINK_SEGUNDOS * 1000),
    };
  }

  private async aplicarRetencao(contaId: string) {
    const concluidos = await this.prisma.backupDesktop.findMany({
      where: { contaId, status: 'CONCLUIDO', concluidoEm: { not: null } },
      select: { id: true, chave: true, concluidoEm: true },
    });
    const sair = backupsParaApagar(
      concluidos.map((b) => ({ id: b.id, chave: b.chave, concluidoEm: b.concluidoEm as Date })),
    );
    await this.apagar(sair);
  }

  private async limparAbandonados(contaId: string) {
    const abandonados = await this.prisma.backupDesktop.findMany({
      where: {
        contaId,
        status: 'ENVIANDO',
        criadoEm: { lt: new Date(Date.now() - ABANDONADO_MS) },
      },
      select: { id: true, chave: true },
    });
    await this.apagar(abandonados);
  }

  private async apagar(backups: { id: string; chave: string }[]) {
    if (!backups.length) return;
    await this.storage.removerObjetos(
      this.storage.bucketOriginais,
      backups.map((b) => b.chave),
    );
    await this.prisma.backupDesktop.deleteMany({ where: { id: { in: backups.map((b) => b.id) } } });
    this.logger.log(`${backups.length} backup(s) antigo(s) removido(s)`);
  }
}

function resumir(
  b: Prisma.BackupDesktopGetPayload<{ include: { dispositivo: { select: { nome: true } } } }>,
): BackupResumo {
  return {
    id: b.id,
    criadoEm: b.criadoEm,
    concluidoEm: b.concluidoEm,
    tamanhoBytes: b.tamanhoBytes,
    sha256: b.sha256,
    versaoApp: b.versaoApp,
    resumo: b.resumo,
    computador: b.dispositivo?.nome ?? null,
  };
}
