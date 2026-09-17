import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Formato único de erro para toda a API:
 *   { status, codigo, mensagem, erros?, caminho, horario }
 */
@Catch()
export class HttpExcecaoFiltro implements ExceptionFilter {
  private readonly logger = new Logger(HttpExcecaoFiltro.name);

  catch(excecao: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      excecao instanceof HttpException ? excecao.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const corpo = excecao instanceof HttpException ? excecao.getResponse() : null;
    const detalhes: Record<string, unknown> =
      typeof corpo === 'object' && corpo !== null
        ? (corpo as Record<string, unknown>)
        : { mensagem: typeof corpo === 'string' ? corpo : 'Erro interno' };

    if (status >= 500) {
      this.logger.error(excecao instanceof Error ? excecao.stack : String(excecao));
    }

    res.status(status).json({
      status,
      codigo: detalhes.codigo ?? (status >= 500 ? 'ERRO_INTERNO' : 'ERRO_HTTP'),
      mensagem: detalhes.mensagem ?? detalhes.message ?? 'Erro interno',
      ...(detalhes.erros ? { erros: detalhes.erros } : {}),
      caminho: req.url,
      horario: new Date().toISOString(),
    });
  }
}
