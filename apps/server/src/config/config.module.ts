import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { validarEnv } from './env.js';

/**
 * Carrega `.env` (ou `.env.test` quando NODE_ENV=test), valida com zod e expõe
 * um ConfigService tipado (`ConfigService<Env, true>`) para toda a aplicação.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      validate: validarEnv,
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
