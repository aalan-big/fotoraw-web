import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { AuditoriaModule } from './infra/auditoria/auditoria.module.js';
import { EmailModule } from './infra/email/email.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { StorageModule } from './infra/storage/storage.module.js';
import { AdminModule } from './modulos/admin/admin.module.js';
import { AuthModule } from './modulos/auth/auth.module.js';
import { ContasModule } from './modulos/contas/contas.module.js';
import { FinanceiroModule } from './modulos/financeiro/financeiro.module.js';
import { GaleriasModule } from './modulos/galerias/galerias.module.js';
import { LicencasModule } from './modulos/licencas/licencas.module.js';
import { PedidosModule } from './modulos/pedidos/pedidos.module.js';
import { PlanosModule } from './modulos/planos/planos.module.js';
import { PublicoModule } from './modulos/publico/publico.module.js';
import { SaudeModule } from './modulos/saude/saude.module.js';
import { SyncModule } from './modulos/sync/sync.module.js';

@Module({
  imports: [
    // infra (globais)
    ConfigModule,
    PrismaModule,
    EmailModule,
    AuditoriaModule,
    StorageModule,
    // domínio — cada módulo novo entra aqui
    SaudeModule,
    AuthModule,
    LicencasModule,
    ContasModule,
    AdminModule,
    PublicoModule,
    GaleriasModule,
    SyncModule,
    PedidosModule,
    FinanceiroModule,
    PlanosModule,
  ],
})
export class AppModule {}
