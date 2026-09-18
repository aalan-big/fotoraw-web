import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Contexto } from '../auth.service.js';

/** IP e user agent da requisição, pra sessão e auditoria. */
export const Ctx = createParamDecorator((_: unknown, ctx: ExecutionContext): Contexto => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null };
});
