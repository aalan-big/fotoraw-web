import { Controller, Get, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../comum/pipes/zod-validation.pipe.js';
import { type ListarGaleriasDto, listarGaleriasSchema } from './dto/listar-galerias.dto.js';
import { PublicoService } from './publico.service.js';

/** Rotas sem autenticação consumidas pela vitrine (Nuxt). */
@Controller('publico')
export class PublicoController {
  constructor(private readonly publico: PublicoService) {}

  @Get('galerias')
  listarGalerias(@Query(new ZodValidationPipe(listarGaleriasSchema)) dto: ListarGaleriasDto) {
    return this.publico.listarGalerias(dto);
  }
}
