import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module.js';
import { HttpExcecaoFiltro } from '../../src/comum/filtros/http-excecao.filtro.js';

/**
 * Sobe a aplicação inteira (mesmos pipes/filtros do main.ts) para testes e2e.
 * `ajustar` permite sobrescrever providers (ex.: mockar o provedor de pagamento).
 */
export async function criarApp(
  ajustar?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (ajustar) builder = ajustar(builder);

  const modulo = await builder.compile();
  const app = modulo.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExcecaoFiltro());
  await app.init();
  return app;
}
