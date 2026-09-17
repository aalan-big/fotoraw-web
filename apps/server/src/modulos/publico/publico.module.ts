import { Module } from '@nestjs/common';
import { PublicoController } from './publico.controller.js';
import { PublicoService } from './publico.service.js';
import { GaleriasPublicasRepositorio } from './repositorios/galerias-publicas.repositorio.js';

@Module({
  controllers: [PublicoController],
  providers: [PublicoService, GaleriasPublicasRepositorio],
})
export class PublicoModule {}
