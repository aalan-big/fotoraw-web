import { Controller, Get, UseGuards } from '@nestjs/common';
import type { Conta } from '../../infra/prisma/gerado/client.js';
import { ContaAtual } from '../auth/decorators/conta-atual.decorator.js';
import { TokenApiGuard } from '../auth/guards/token-api.guard.js';
import { LicencasService } from './licencas.service.js';

/** Desktop pergunta "o que eu posso?" a cada N dias (e ao publicar). */
@Controller('licencas')
@UseGuards(TokenApiGuard)
export class LicencasController {
  constructor(private readonly licencas: LicencasService) {}

  @Get('atual')
  atual(@ContaAtual() conta: Conta) {
    return this.licencas.atual(conta.id);
  }
}
