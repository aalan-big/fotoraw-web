import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LicencasController } from './licencas.controller.js';
import { LicencasService } from './licencas.service.js';
import { LicencasRepositorio } from './repositorios/licencas.repositorio.js';

/** forwardRef: o auth emite o trial no cadastro e este módulo usa o TokenApiGuard do auth. */
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [LicencasController],
  providers: [LicencasService, LicencasRepositorio],
  exports: [LicencasService, LicencasRepositorio],
})
export class LicencasModule {}
