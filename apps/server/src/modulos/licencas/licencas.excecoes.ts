import { HttpStatus } from '@nestjs/common';
import { DominioExcecao } from '../../comum/excecoes/dominio.excecao.js';

export class PlanoNaoEncontradoExcecao extends DominioExcecao {
  constructor(id: string) {
    super('PLANO_NAO_ENCONTRADO', `Plano ${id} não encontrado`, HttpStatus.NOT_FOUND);
  }
}

export class ValidadeObrigatoriaExcecao extends DominioExcecao {
  constructor() {
    super('VALIDADE_OBRIGATORIA', 'Licença de cortesia ou trial precisa de data de validade');
  }
}

export class LicencaEncerradaExcecao extends DominioExcecao {
  constructor(status: string) {
    super(
      'LICENCA_ENCERRADA',
      `Licença ${status.toLowerCase()} não pode mudar de status — emita outra`,
    );
  }
}

export class OutraLicencaAtivaExcecao extends DominioExcecao {
  constructor(chave: string) {
    super(
      'OUTRA_LICENCA_ATIVA',
      `A conta já tem a licença ${chave} ativa — suspenda ou revogue antes`,
      HttpStatus.CONFLICT,
    );
  }
}
