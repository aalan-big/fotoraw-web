import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GaleriasController } from './galerias.controller.js';
import { GaleriasService } from './galerias.service.js';
import { GaleriasRepositorio } from './repositorios/galerias.repositorio.js';

@Module({
  imports: [AuthModule],
  controllers: [GaleriasController],
  providers: [GaleriasRepositorio, GaleriasService],
  exports: [GaleriasService, GaleriasRepositorio],
})
export class GaleriasModule {}
