import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LicencasModule } from '../licencas/licencas.module.js';
import { SaudeModule } from '../saude/saude.module.js';
import { AssinaturasAdminController } from './assinaturas.admin.controller.js';
import { AssinaturasAdminService } from './assinaturas.admin.service.js';
import { FinanceiroAdminController } from './financeiro.admin.controller.js';
import { FinanceiroAdminService } from './financeiro.admin.service.js';
import { SistemaAdminController } from './sistema.admin.controller.js';
import { SistemaAdminService } from './sistema.admin.service.js';
import { AdminsAdminController, SegurancaAdminController } from './admins.admin.controller.js';
import { AdminsAdminService } from './admins.admin.service.js';
import { SegurancaAdminService } from './seguranca.admin.service.js';
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
  imports: [AuthModule, LicencasModule, SaudeModule],
  controllers: [
    VisaoGeralAdminController,
    ContasAdminController,
    LicencasAdminController,
    PlanosAdminController,
    ConfiguracoesAdminController,
    AssinaturasAdminController,
    FinanceiroAdminController,
    SistemaAdminController,
    SegurancaAdminController,
    AdminsAdminController,
  ],
  providers: [
    ContasAdminService,
    LicencasAdminService,
    PlanosAdminService,
    ConfiguracoesAdminService,
    AssinaturasAdminService,
    FinanceiroAdminService,
    SistemaAdminService,
    SegurancaAdminService,
    AdminsAdminService,
    ContasAdminRepositorio,
  ],
})
export class AdminModule {}
