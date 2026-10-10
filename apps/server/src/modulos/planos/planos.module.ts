import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditoriaModule } from '../../infra/auditoria/auditoria.module.js';
import { PrismaModule } from '../../infra/prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { LicencasModule } from '../licencas/licencas.module.js';
import { PagamentosModule } from '../pagamentos/pagamentos.module.js';
import { PlanosController } from './planos.controller.js';
import { PlanosPublicoController } from './planos-publico.controller.js';
import { PlanosService } from './planos.service.js';
import { PlanosRepositorio } from './repositorios/planos.repositorio.js';

@Module({
  imports: [PrismaModule, LicencasModule, PagamentosModule, AuditoriaModule, ConfigModule, AuthModule],
  controllers: [PlanosController, PlanosPublicoController],
  providers: [PlanosService, PlanosRepositorio],
  exports: [PlanosService, PlanosRepositorio],
})
export class PlanosModule {}
