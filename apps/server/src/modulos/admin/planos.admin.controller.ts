import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { SoAdmin } from './admin.guards.js';

/** Catálogo de planos (leitura). Edição chega no passo 3 do ambiente admin. */
@Controller('admin/planos')
@SoAdmin()
export class PlanosAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listar() {
    return this.prisma.plano.findMany({ orderBy: { ordem: 'asc' } });
  }
}
