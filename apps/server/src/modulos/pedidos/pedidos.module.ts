import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PedidosController } from './pedidos.controller.js';
import { PedidosService } from './pedidos.service.js';
import { PedidosRepositorio } from './repositorios/pedidos.repositorio.js';

@Module({
  imports: [AuthModule],
  controllers: [PedidosController],
  providers: [PedidosRepositorio, PedidosService],
  exports: [PedidosService, PedidosRepositorio],
})
export class PedidosModule {}
