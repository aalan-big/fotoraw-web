import { describe, expect, it } from 'vitest';
import {
  emailCartaoRecusado,
  emailPagamentoConfirmado,
  emailPlanoCancelado,
  emailPlanoPreVencimento,
  emailPlanoVencido,
} from './emails-cobranca.js';

describe('emails-cobranca', () => {
  const dadosBase = {
    para: 'fotografo@exemplo.com',
    nome: 'Carlos Silva',
    planoNome: 'FotoRAW PRO',
  };

  it('emailPagamentoConfirmado gera assunto e corpo corretos', () => {
    const email = emailPagamentoConfirmado({
      ...dadosBase,
      valorFormatado: 'R$ 59,90',
      validaAteFormatado: '14/11/2026',
      linkPainel: 'https://painel.fotoraw.com.br/plano',
    });

    expect(email.para).toBe('fotografo@exemplo.com');
    expect(email.assunto).toContain('Pagamento confirmado');
    expect(email.assunto).toContain('FotoRAW PRO');
    expect(email.html).toContain('Carlos Silva');
    expect(email.html).toContain('R$ 59,90');
    expect(email.html).toContain('14/11/2026');
    expect(email.html).toContain('https://painel.fotoraw.com.br/plano');
    expect(email.texto).toContain('R$ 59,90');
  });

  it('emailCartaoRecusado contém link para trocar o cartão', () => {
    const email = emailCartaoRecusado({
      ...dadosBase,
      valorFormatado: 'R$ 59,90',
      linkTrocarCartao: 'https://painel.fotoraw.com.br/plano',
    });

    expect(email.para).toBe('fotografo@exemplo.com');
    expect(email.assunto).toContain('não autorizada');
    expect(email.html).toContain('recusou a cobrança');
    expect(email.html).toContain('Atualizar Dados do Cartão');
    expect(email.html).toContain('https://painel.fotoraw.com.br/plano');
    expect(email.texto).toContain('https://painel.fotoraw.com.br/plano');
  });

  it('emailPlanoPreVencimento alerta 3 dias antes', () => {
    const email = emailPlanoPreVencimento({
      ...dadosBase,
      dias: 3,
      venceEmFormatado: '17/10/2026',
      linkPainel: 'https://painel.fotoraw.com.br/plano',
    });

    expect(email.assunto).toContain('vence em 3 dias');
    expect(email.html).toContain('3 dias');
    expect(email.html).toContain('17/10/2026');
  });

  it('emailPlanoVencido avisa sobre plano vencido', () => {
    const email = emailPlanoVencido({
      ...dadosBase,
      linkRenovar: 'https://painel.fotoraw.com.br/plano',
    });

    expect(email.assunto).toContain('renovação pendente');
    expect(email.html).toContain('chegou ao fim e a renovação ainda não foi confirmada');
    expect(email.html).toContain('Renovar Meu Plano Agora');
  });

  it('emailPlanoCancelado trata cancelamento no fim do período e cancelamento imediato', () => {
    const noFim = emailPlanoCancelado({
      ...dadosBase,
      noFimDoPeriodo: true,
      terminaEmFormatado: '14/11/2026',
      linkPainel: 'https://painel.fotoraw.com.br/plano',
    });

    expect(noFim.assunto).toContain('Cancelamento do plano FotoRAW PRO');
    expect(noFim.html).toContain('Ativo até 14/11/2026');
    expect(noFim.texto).toContain('válidos até 14/11/2026');

    const imediato = emailPlanoCancelado({
      ...dadosBase,
      noFimDoPeriodo: false,
      linkPainel: 'https://painel.fotoraw.com.br/plano',
    });

    expect(imediato.html).toContain('retornou ao plano Gratuito');
  });
});
