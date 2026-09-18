import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SenhaService } from '../auth/senha/senha.service.js';
import { LicencasModule } from '../licencas/licencas.module.js';
import { ContasController } from './contas.controller.js';
import { ContasService } from './contas.service.js';
import { ContasRepositorio } from './repositorios/contas.repositorio.js';

@Module({
  imports: [AuthModule, LicencasModule],
  controllers: [ContasController],
  providers: [ContasService, ContasRepositorio, SenhaService],
})
export class ContasModule {}
