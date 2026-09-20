import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LicencasModule } from '../licencas/licencas.module.js';
import { AssinaturasAdminController } from './assinaturas.admin.controller.js';
import { AssinaturasAdminService } from './assinaturas.admin.service.js';
import { ConfiguracoesAdminController } from './configuracoes.admin.controller.js';
import { ConfiguracoesAdminService } from './configuracoes.admin.service.js';
import { ContasAdminController } from './contas.admin.controller.js';
import { ContasAdminService } from './contas.admin.service.js';
import { LicencasAdminController } from './licencas.admin.controller.js';
import { LicencasAdminService } from './licencas.admin.service.js';
import { PlanosAdminController } from './planos.admin.controller.js';
import { PlanosAdminService } from './planos.admin.service.js';
import { ContasAdminRepositorio } from './repositorios/contas.admin.repositorio.js';
import { VisaoGeralAdminController } from './visao-geral.admin.controller.js';

/** Gestão da plataforma (docs/fluxos/ambiente-admin.md). Tudo aqui exige papel ADMIN. */
@Module({
  imports: [AuthModule, LicencasModule],
  controllers: [
    VisaoGeralAdminController,
    ContasAdminController,
    LicencasAdminController,
    PlanosAdminController,
    ConfiguracoesAdminController,
    AssinaturasAdminController,
  ],
  providers: [
    ContasAdminService,
    LicencasAdminService,
    PlanosAdminService,
    ConfiguracoesAdminService,
    AssinaturasAdminService,
    ContasAdminRepositorio,
  ],
})
export class AdminModule {}
