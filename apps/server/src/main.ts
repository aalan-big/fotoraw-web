import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { HttpExcecaoFiltro } from './comum/filtros/http-excecao.filtro.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // atrás de proxy (Railway/Fly/nginx) o IP real vem no X-Forwarded-For — o throttle e a auditoria usam req.ip
  if (config.get('NODE_ENV') === 'production')
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableCors({
    origin: [config.get('WEB_URL'), config.get('FOTOGRAFO_URL'), config.get('ADMIN_URL')],
    credentials: true,
  });
  app.useGlobalFilters(new HttpExcecaoFiltro());
  app.enableShutdownHooks();

  const porta = config.get('PORT');
  await app.listen(porta);
  Logger.log(`API no ar em http://localhost:${porta}/api`, 'Bootstrap');
}

await bootstrap();
