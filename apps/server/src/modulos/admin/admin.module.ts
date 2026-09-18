import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LicencasModule } from '../licencas/licencas.module.js';
import { ContasAdminController } from './contas.admin.controller.js';
import { ContasAdminService } from './contas.admin.service.js';
import { LicencasAdminController } from './licencas.admin.controller.js';
import { LicencasAdminService } from './licencas.admin.service.js';
import { ContasAdminRepositorio } from './repositorios/contas.admin.repositorio.js';

/** Gestão da plataforma (docs/fluxos/ambiente-admin.md). Tudo aqui exige papel ADMIN. */
@Module({
  imports: [AuthModule, LicencasModule],
  controllers: [ContasAdminController, LicencasAdminController],
  providers: [ContasAdminService, LicencasAdminService, ContasAdminRepositorio],
})
export class AdminModule {}
