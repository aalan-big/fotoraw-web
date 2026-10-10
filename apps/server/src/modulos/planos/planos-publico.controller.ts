import { Controller, Get } from '@nestjs/common';
import { PlanosService } from './planos.service.js';

/** Catálogo sem login, pra página /planos da vitrine. Só planos ativos; nada da conta. */
@Controller('publico/planos')
export class PlanosPublicoController {
  constructor(private readonly planos: PlanosService) {}

  @Get()
  listar() {
    return this.planos.listarPlanos();
  }
}
