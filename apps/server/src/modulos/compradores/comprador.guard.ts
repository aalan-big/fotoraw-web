import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CompradoresService } from './compradores.service.js';

interface ComRequisicao {
  headers: Record<string, string | undefined>;
  compradorId?: string;
}

/** Bearer do comprador (token próprio, assinado com segredo separado do fotógrafo). */
@Injectable()
export class CompradorGuard implements CanActivate {
  constructor(private readonly compradores: CompradoresService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ComRequisicao>();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Entre pra ver suas fotos');
    const id = await this.compradores.validarToken(token);
    if (!id) throw new UnauthorizedException('Sua sessão expirou. Entre de novo.');
    req.compradorId = id;
    return true;
  }
}

export const CompradorAtual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => ctx.switchToHttp().getRequest<ComRequisicao>().compradorId!,
);
