import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { HttpExcecaoFiltro } from './comum/filtros/http-excecao.filtro.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get('WEB_URL'), credentials: true });
  app.useGlobalFilters(new HttpExcecaoFiltro());
  app.enableShutdownHooks();

  const porta = config.get('PORT');
  await app.listen(porta);
  Logger.log(`API no ar em http://localhost:${porta}/api`, 'Bootstrap');
}

await bootstrap();
