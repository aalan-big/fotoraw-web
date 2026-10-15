import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompradorGuard } from './comprador.guard.js';
import { CompradoresController } from './compradores.controller.js';
import { CompradoresService } from './compradores.service.js';

/** Área "Minhas fotos" do comprador: entrar sem senha (código por e-mail). */
@Module({
  imports: [AuthModule], // JwtService (assina com segredo próprio do comprador)
  controllers: [CompradoresController],
  providers: [CompradoresService, CompradorGuard],
})
export class CompradoresModule {}
