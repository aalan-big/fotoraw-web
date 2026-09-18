import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RequisicaoAutenticada } from '../guards/requisicao.js';

/** A conta que o guard autenticou: `metodo(@ContaAtual() conta: Conta)`. */
export const ContaAtual = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<RequisicaoAutenticada>().conta;
});
