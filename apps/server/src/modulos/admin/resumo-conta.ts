import type { LicencaAtual } from '../licencas/licencas.service.js';

/**
 * Visão 360 de uma conta pro painel lateral do admin: saúde (o que precisa de
 * atenção), uso contra os limites do plano e a linha do tempo unificada.
 * Só leitura e cálculo — nada persiste.
 */

export type NivelSaude = 'ok' | 'atencao' | 'critico';

export interface AlertaSaude {
  codigo: string;
  nivel: Exclude<NivelSaude, 'ok'>;
  texto: string;
}

export interface EventoLinhaDoTempo {
  quando: Date;
  /** conta · sessao · desktop · licenca · galeria · venda · admin */
  tipo: string;
  texto: string;
  /** quem fez, quando foi ação de alguém (admin ou o próprio fotógrafo) */
  ator?: string | null;
}

export interface EntradaSaude {
  status: 'ATIVA' | 'SUSPENSA' | 'BLOQUEADA';
  emailVerificado: boolean;
  criadoEm: Date;
  licenca: LicencaAtual;
  dispositivos: number;
  galeriasPublicadas: number;
  ultimaPublicacaoEm: Date | null;
  ultimoLoginEm: Date | null;
  ultimoDesktopEm: Date | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;
const dias = (d: Date | null) => (d ? Math.floor((Date.now() - d.getTime()) / DIA_MS) : null);

export function calcularSaude(e: EntradaSaude): { nivel: NivelSaude; alertas: AlertaSaude[] } {
  const alertas: AlertaSaude[] = [];
  const idade = dias(e.criadoEm) ?? 0;

  if (e.status === 'BLOQUEADA') {
    alertas.push({ codigo: 'bloqueada', nivel: 'critico', texto: 'Conta bloqueada' });
  } else if (e.status === 'SUSPENSA') {
    alertas.push({ codigo: 'suspensa', nivel: 'critico', texto: 'Conta suspensa' });
  }
  if (!e.emailVerificado) {
    alertas.push({
      codigo: 'email_nao_confirmado',
      nivel: 'atencao',
      texto: `E-mail não confirmado há ${idade} dia${idade === 1 ? '' : 's'}`,
    });
  }
  if (e.licenca.plano === 'trial' && e.licenca.diasRestantes !== null) {
    if (e.licenca.diasRestantes <= 7) {
      alertas.push({
        codigo: 'trial_vencendo',
        nivel: 'atencao',
        texto:
          e.licenca.diasRestantes === 0
            ? 'Trial vence hoje'
            : `Trial vence em ${e.licenca.diasRestantes} dia${e.licenca.diasRestantes === 1 ? '' : 's'}`,
      });
    }
  }
  if (
    e.licenca.plano === 'pro' &&
    e.licenca.diasRestantes !== null &&
    e.licenca.diasRestantes <= 7
  ) {
    alertas.push({
      codigo: 'licenca_vencendo',
      nivel: 'atencao',
      texto: `Licença vence em ${e.licenca.diasRestantes} dia${e.licenca.diasRestantes === 1 ? '' : 's'}`,
    });
  }
  if (e.dispositivos === 0 && idade >= 1) {
    alertas.push({
      codigo: 'sem_desktop',
      nivel: 'atencao',
      texto: 'Nunca conectou o desktop',
    });
  }
  const semPublicar = dias(e.ultimaPublicacaoEm);
  if (e.galeriasPublicadas === 0 && idade >= 7) {
    alertas.push({ codigo: 'sem_galeria', nivel: 'atencao', texto: 'Nenhuma galeria publicada' });
  } else if (semPublicar !== null && semPublicar >= 30) {
    alertas.push({
      codigo: 'parado',
      nivel: 'atencao',
      texto: `Sem publicar há ${semPublicar} dias`,
    });
  }
  const semLogin = dias(e.ultimoLoginEm);
  const semDesktop = dias(e.ultimoDesktopEm);
  const ultimoUso = Math.min(semLogin ?? Infinity, semDesktop ?? Infinity);
  if (ultimoUso !== Infinity && ultimoUso >= 30) {
    alertas.push({ codigo: 'sumido', nivel: 'atencao', texto: `Sem entrar há ${ultimoUso} dias` });
  }

  const nivel: NivelSaude = alertas.some((a) => a.nivel === 'critico')
    ? 'critico'
    : alertas.length
      ? 'atencao'
      : 'ok';
  return { nivel, alertas };
}

/** Texto amigável pra cada ação da auditoria (o que não estiver aqui aparece como veio). */
export const ROTULO_ACAO: Record<string, string> = {
  'conta.criada': 'Conta criada',
  'conta.ativa': 'Conta reativada pelo admin',
  'conta.suspensa': 'Conta suspensa pelo admin',
  'conta.bloqueada': 'Conta bloqueada pelo admin',
  'conta.excluida': 'Conta excluída',
  'conta.reenviar_verificacao': 'E-mail de confirmação reenviado',
  'email.verificado': 'E-mail confirmado',
  'email.trocado': 'E-mail trocado',
  'senha.trocada': 'Senha trocada',
  'senha.redefinida': 'Senha redefinida pelo link',
  'sessao.reuso_detectado': 'Reuso de sessão detectado — sessões derrubadas',
  'dispositivo.vinculado': 'Desktop conectado',
  'dispositivo.reconectado': 'Desktop reconectado',
  'dispositivo.revogado': 'Desktop desconectado',
  'licenca.emitir': 'Licença emitida',
  'licenca.ativa': 'Licença reativada',
  'licenca.suspensa': 'Licença suspensa',
  'licenca.revogada': 'Licença revogada',
  'perfil.taxas_para_cliente': 'Mudou quem paga as taxas',
  'assinatura.criar': 'Assinatura manual criada',
  'assinatura.cancelar': 'Assinatura cancelada na hora',
  'assinatura.cancelar_no_fim': 'Assinatura encerra no fim do período',
  'assinatura.observacao': 'Observação da assinatura alterada',
  'fatura.marcar_paga': 'Fatura marcada como paga',
  'repasse.gerar': 'Repasse gerado',
  'repasse.pagar': 'Repasse pago (Pix)',
  'repasse.falhou': 'Repasse falhou',
  'plano.editar': 'Plano editado',
  'plano.reemitir': 'Licenças do plano reemitidas',
  'config.alterar': 'Configuração alterada',
  'webhook.reprocessar': 'Webhook devolvido à fila',
};

export function rotuloAcao(acao: string, depois: unknown): string {
  const base = ROTULO_ACAO[acao] ?? acao;
  const d = (depois ?? {}) as Record<string, unknown>;
  const extra =
    typeof d.nome === 'string'
      ? d.nome
      : typeof d.motivo === 'string'
        ? d.motivo.replace(/^plano:[^ ]+ · /, '')
        : typeof d.plano === 'string'
          ? d.plano
          : typeof d.tipo === 'string'
            ? d.tipo.toLowerCase()
            : null;
  return extra ? `${base} — ${extra}` : base;
}
