import { Module } from '@nestjs/common';
import { SenhaService } from '../auth/senha/senha.service.js';
import { PagamentosModule } from '../pagamentos/pagamentos.module.js';
import { PublicoController } from './publico.controller.js';
import { PublicoService } from './publico.service.js';
import { GaleriasPublicasRepositorio } from './repositorios/galerias-publicas.repositorio.js';

@Module({
  imports: [PagamentosModule],
  controllers: [PublicoController],
  providers: [PublicoService, GaleriasPublicasRepositorio, SenhaService],
})
export class PublicoModule {}
