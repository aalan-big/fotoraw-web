import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../../config/env.js';
import { PrismaClient } from './gerado/client.js';

/**
 * Único ponto de acesso ao banco. Os módulos de domínio usam via `repositorios/`,
 * nunca direto no service.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    const adapter = new PrismaPg({ connectionString: config.get('DATABASE_URL') });
    super({
      adapter,
      log: config.get('NODE_ENV') === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conectado ao Postgres');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
