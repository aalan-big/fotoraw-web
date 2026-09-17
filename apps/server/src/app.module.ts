import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { SaudeModule } from './modulos/saude/saude.module.js';

@Module({
  imports: [
    // infra (globais)
    ConfigModule,
    PrismaModule,
    // domínio — cada módulo novo entra aqui
    SaudeModule,
  ],
})
export class AppModule {}
