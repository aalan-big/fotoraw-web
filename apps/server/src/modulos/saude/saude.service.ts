import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

export interface EstadoSaude {
  status: 'ok' | 'degradado';
  banco: 'ok' | 'erro';
  horario: string;
}

@Injectable()
export class SaudeService {
  constructor(private readonly prisma: PrismaService) {}

  async verificar(): Promise<EstadoSaude> {
    let banco: EstadoSaude['banco'] = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      banco = 'erro';
    }
    return {
      status: banco === 'ok' ? 'ok' : 'degradado',
      banco,
      horario: new Date().toISOString(),
    };
  }
}
