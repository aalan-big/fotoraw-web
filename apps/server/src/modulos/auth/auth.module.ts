import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Env } from '../../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtGuard } from './guards/jwt.guard.js';
import { PapelGuard } from './guards/papel.guard.js';
import { TokenApiGuard } from './guards/token-api.guard.js';
import { ContasAuthRepositorio } from './repositorios/contas.repositorio.js';
import { DispositivosRepositorio } from './repositorios/dispositivos.repositorio.js';
import { SessoesWebRepositorio } from './repositorios/sessoes-web.repositorio.js';
import { TokensVerificacaoRepositorio } from './repositorios/tokens-verificacao.repositorio.js';
import { LimitadorTentativas } from './senha/limitador-tentativas.js';
import { SenhaService } from './senha/senha.service.js';

/**
 * Identidade: cadastro/login web, vínculo do desktop, guards pros outros módulos.
 * O ThrottlerGuard entra como guard global daqui (limite por IP; as rotas sensíveis
 * apertam com `@Throttle`). Em `test` o limite por IP é desligado — os e2e batem
 * todos de 127.0.0.1; o limite por e-mail (LimitadorTentativas) continua valendo.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [{ name: 'default', limit: 300, ttl: 60 * 1000 }],
        skipIf: () => config.get('NODE_ENV') === 'test',
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SenhaService,
    { provide: LimitadorTentativas, useFactory: () => new LimitadorTentativas() },
    ContasAuthRepositorio,
    SessoesWebRepositorio,
    TokensVerificacaoRepositorio,
    DispositivosRepositorio,
    JwtGuard,
    TokenApiGuard,
    PapelGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [AuthService, JwtGuard, TokenApiGuard, PapelGuard, JwtModule, ContasAuthRepositorio],
})
export class AuthModule {}
