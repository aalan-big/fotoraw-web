import { statfs } from 'node:fs/promises';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service.js';

const INTERVALO_MS = 15 * 60 * 1000;
const DELAY_INICIAL_BOOT_MS = 60 * 1000;
/** enquanto continuar alto, lembra de novo a cada 6 h */
const LEMBRETE_MS = 6 * 60 * 60 * 1000;
const GB = 1024 ** 3;

export type NivelDisco = 'normal' | 'alto' | 'critico';
const ORDEM: Record<NivelDisco, number> = { normal: 0, alto: 1, critico: 2 };

export interface UsoDisco {
  usoPct: number;
  livreGb: number;
  totalGb: number;
}

export interface EstadoVigia {
  nivel: NivelDisco;
  avisadoEm: number | null;
}

/** Mesma conta do `df`: o espaço reservado ao root não entra como livre. */
export async function lerDisco(caminho = '/'): Promise<UsoDisco> {
  const s = await statfs(caminho);
  const usado = (s.blocks - s.bfree) * s.bsize;
  const disponivel = s.bavail * s.bsize;
  const total = usado + disponivel;
  return {
    usoPct: total > 0 ? Math.round((usado / total) * 100) : 0,
    livreGb: Math.round((disponivel / GB) * 10) / 10,
    totalGb: Math.round((s.blocks * s.bsize) / GB),
  };
}

export const nivelDoUso = (pct: number): NivelDisco =>
  pct >= 90 ? 'critico' : pct >= 80 ? 'alto' : 'normal';

/**
 * Avisa quando o nível sobe, lembra a cada 6 h enquanto estiver alto e avisa uma vez
 * quando volta ao normal. Retorna o estado novo e o aviso (se houver).
 */
export function decidirAviso(
  anterior: EstadoVigia,
  uso: UsoDisco,
  agora: number,
): { estado: EstadoVigia; aviso: { titulo: string; corpo: string } | null } {
  const nivel = nivelDoUso(uso.usoPct);
  const livre = `${uso.livreGb.toLocaleString('pt-BR')} GB livres de ${uso.totalGb} GB`;

  if (nivel === 'normal') {
    const aviso =
      anterior.nivel !== 'normal'
        ? { titulo: `Disco da VPS voltou ao normal (${uso.usoPct}%)`, corpo: livre }
        : null;
    return { estado: { nivel, avisadoEm: null }, aviso };
  }

  const subiu = ORDEM[nivel] > ORDEM[anterior.nivel];
  const lembrar = anterior.avisadoEm !== null && agora - anterior.avisadoEm >= LEMBRETE_MS;
  if (!subiu && !lembrar) return { estado: { nivel, avisadoEm: anterior.avisadoEm }, aviso: null };

  return {
    estado: { nivel, avisadoEm: agora },
    aviso: {
      titulo: `${nivel === 'critico' ? '🚨' : '⚠️'} Disco da VPS em ${uso.usoPct}%`,
      corpo:
        `${livre}. Se encher, o banco do SeuPercurso e o do FotoRAW param. ` +
        'Veja o que cresceu: du -xh / --max-depth=2 | sort -h | tail',
    },
  };
}

/**
 * Vigia o disco da VPS (compartilhada com o SeuPercurso) e avisa no celular do admin.
 * Em 10/2026 o disco encheu sem ninguém ver e derrubou o banco do SeuPercurso.
 * Estado em memória (1 instância); depois de um restart avisa de novo se ainda estiver alto.
 */
@Injectable()
export class VigiaDiscoService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(VigiaDiscoService.name);
  private estado: EstadoVigia = { nivel: 'normal', avisadoEm: null };
  private timer: NodeJS.Timeout | null = null;
  private delayInicial: NodeJS.Timeout | null = null;

  constructor(private readonly notificacoes: NotificacoesService) {}

  onApplicationBootstrap() {
    this.delayInicial = setTimeout(() => {
      void this.verificar();
      this.timer = setInterval(() => void this.verificar(), INTERVALO_MS);
    }, DELAY_INICIAL_BOOT_MS);
  }

  onApplicationShutdown() {
    if (this.delayInicial) clearTimeout(this.delayInicial);
    if (this.timer) clearInterval(this.timer);
  }

  async verificar() {
    try {
      const uso = await lerDisco();
      const { estado, aviso } = decidirAviso(this.estado, uso, Date.now());
      this.estado = estado;
      if (!aviso) return;
      this.logger.warn(`${aviso.titulo} — ${uso.livreGb} GB livres`);
      await this.notificacoes.avisarAdmins({ ...aviso, url: '/sistema' });
    } catch (erro) {
      this.logger.error(`falha ao ler o disco: ${erro instanceof Error ? erro.message : erro}`);
    }
  }
}
