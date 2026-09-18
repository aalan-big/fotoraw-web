import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MuitasTentativasExcecao } from '../auth.excecoes.js';

/** ThrottlerGuard com o erro no formato da API ({ codigo, mensagem }) em vez do texto cru. */
@Injectable()
export class LimiteIpGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(): Promise<void> {
    throw new MuitasTentativasExcecao();
  }
}
