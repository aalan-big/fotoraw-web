import { Injectable } from '@nestjs/common';

interface Janela {
  tentativas: number;
  abertaEm: number;
}

/**
 * Limita tentativas de login por chave (e-mail) — complementa o ThrottlerModule,
 * que limita por IP. Em memória: serve pra uma instância; com mais de uma, trocar
 * o Map por Redis mantendo a mesma interface.
 */
@Injectable()
export class LimitadorTentativas {
  private readonly janelas = new Map<string, Janela>();

  constructor(
    private readonly maximo = 5,
    private readonly janelaMs = 15 * 60 * 1000,
    private readonly agora: () => number = Date.now,
  ) {}

  bloqueado(chave: string): boolean {
    const janela = this.janelas.get(chave);
    if (!janela) return false;
    if (this.agora() - janela.abertaEm > this.janelaMs) {
      this.janelas.delete(chave);
      return false;
    }
    return janela.tentativas >= this.maximo;
  }

  registrarFalha(chave: string): void {
    const agora = this.agora();
    const janela = this.janelas.get(chave);
    if (!janela || agora - janela.abertaEm > this.janelaMs) {
      this.janelas.set(chave, { tentativas: 1, abertaEm: agora });
      return;
    }
    janela.tentativas += 1;
  }

  limpar(chave: string): void {
    this.janelas.delete(chave);
  }

  /** Zera tudo — usado pelos testes entre cenários. */
  reiniciar(): void {
    this.janelas.clear();
  }
}
