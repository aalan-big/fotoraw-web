import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base para erros de regra de negócio. Cada módulo estende com um `codigo`
 * estável que o front (Nuxt) e o desktop podem tratar sem depender da mensagem.
 */
export class DominioExcecao extends HttpException {
  constructor(
    public readonly codigo: string,
    mensagem: string,
    status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super({ codigo, mensagem }, status);
  }
}

export class NaoEncontradoExcecao extends DominioExcecao {
  constructor(recurso: string, id?: string) {
    super(
      'NAO_ENCONTRADO',
      id ? `${recurso} ${id} não encontrado(a)` : `${recurso} não encontrado(a)`,
      HttpStatus.NOT_FOUND,
    );
  }
}
