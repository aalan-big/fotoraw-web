import { LimitadorTentativas } from './limitador-tentativas.js';

describe('LimitadorTentativas', () => {
  let agora = 0;
  const relogio = () => agora;

  beforeEach(() => {
    agora = 1_000_000;
  });

  it('bloqueia depois do máximo de falhas na janela', () => {
    const limitador = new LimitadorTentativas(3, 60_000, relogio);
    limitador.registrarFalha('a@b.c');
    limitador.registrarFalha('a@b.c');
    expect(limitador.bloqueado('a@b.c')).toBe(false);
    limitador.registrarFalha('a@b.c');
    expect(limitador.bloqueado('a@b.c')).toBe(true);
  });

  it('libera quando a janela passa', () => {
    const limitador = new LimitadorTentativas(1, 60_000, relogio);
    limitador.registrarFalha('a@b.c');
    expect(limitador.bloqueado('a@b.c')).toBe(true);
    agora += 60_001;
    expect(limitador.bloqueado('a@b.c')).toBe(false);
  });

  it('não mistura chaves e limpa no sucesso', () => {
    const limitador = new LimitadorTentativas(1, 60_000, relogio);
    limitador.registrarFalha('a@b.c');
    expect(limitador.bloqueado('outro@b.c')).toBe(false);
    limitador.limpar('a@b.c');
    expect(limitador.bloqueado('a@b.c')).toBe(false);
  });
});
