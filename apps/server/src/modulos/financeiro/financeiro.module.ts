import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FinanceiroController } from './financeiro.controller.js';
import { FinanceiroService } from './financeiro.service.js';
import { FinanceiroRepositorio } from './repositorios/financeiro.repositorio.js';

@Module({
  imports: [AuthModule],
  controllers: [FinanceiroController],
  providers: [FinanceiroRepositorio, FinanceiroService],
  exports: [FinanceiroService, FinanceiroRepositorio],
})
export class FinanceiroModule {}
