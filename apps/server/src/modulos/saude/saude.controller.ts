import { Controller, Get } from '@nestjs/common';
import { SaudeService } from './saude.service.js';

@Controller('saude')
export class SaudeController {
  constructor(private readonly saude: SaudeService) {}

  /** Liveness + ping no banco. Usado pelo deploy e pelo desktop antes de sincronizar. */
  @Get()
  verificar() {
    return this.saude.verificar();
  }
}
