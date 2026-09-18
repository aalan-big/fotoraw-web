import { HttpStatus } from '@nestjs/common';
import { DominioExcecao } from '../../comum/excecoes/dominio.excecao.js';

/** Mesma resposta pra e-mail inexistente e senha errada — não revela cadastros. */
export class CredenciaisInvalidasExcecao extends DominioExcecao {
  constructor() {
    super('CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos', HttpStatus.UNAUTHORIZED);
  }
}

export class MuitasTentativasExcecao extends DominioExcecao {
  constructor() {
    super(
      'MUITAS_TENTATIVAS',
      'Muitas tentativas. Aguarde 15 minutos e tente de novo',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class ContaBloqueadaExcecao extends DominioExcecao {
  constructor() {
    super('CONTA_BLOQUEADA', 'Esta conta está bloqueada. Fale com o suporte', HttpStatus.FORBIDDEN);
  }
}

export class EmailJaCadastradoExcecao extends DominioExcecao {
  constructor() {
    super('EMAIL_JA_CADASTRADO', 'Já existe uma conta com este e-mail', HttpStatus.CONFLICT);
  }
}

export class SlugJaUsadoExcecao extends DominioExcecao {
  constructor() {
    super('SLUG_JA_USADO', 'Este endereço (@slug) já está em uso', HttpStatus.CONFLICT);
  }
}

export class SenhaFracaExcecao extends DominioExcecao {
  constructor() {
    super('SENHA_FRACA', 'Esta senha é muito comum. Escolha outra');
  }
}

export class SessaoInvalidaExcecao extends DominioExcecao {
  constructor() {
    super('SESSAO_INVALIDA', 'Sessão expirada. Entre de novo', HttpStatus.UNAUTHORIZED);
  }
}

export class TokenInvalidoExcecao extends DominioExcecao {
  constructor() {
    super('TOKEN_INVALIDO', 'Este link é inválido ou já expirou');
  }
}

export class LimiteDispositivosExcecao extends DominioExcecao {
  constructor(limite: number) {
    super(
      'LIMITE_DISPOSITIVOS',
      `Sua licença permite ${limite} ${limite === 1 ? 'máquina' : 'máquinas'}. Revogue uma no painel web para conectar esta`,
      HttpStatus.FORBIDDEN,
    );
  }
}

export class NaoAutenticadoExcecao extends DominioExcecao {
  constructor() {
    super('NAO_AUTENTICADO', 'Entre para continuar', HttpStatus.UNAUTHORIZED);
  }
}

export class SemPermissaoExcecao extends DominioExcecao {
  constructor() {
    super('SEM_PERMISSAO', 'Você não tem permissão para isso', HttpStatus.FORBIDDEN);
  }
}
