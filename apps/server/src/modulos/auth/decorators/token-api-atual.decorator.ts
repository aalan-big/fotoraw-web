import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TokenApi } from '../../../infra/prisma/gerado/client.js';
import type { RequisicaoAutenticada } from '../guards/requisicao.js';

export const TokenApiAtual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenApi | undefined => {
    const req = ctx.switchToHttp().getRequest<RequisicaoAutenticada>();
    return req.tokenApi;
  },
);
