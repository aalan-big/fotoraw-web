import { UseGuards, applyDecorators } from '@nestjs/common';
import { Papel } from '../auth/decorators/papel.decorator.js';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { PapelGuard } from '../auth/guards/papel.guard.js';

/** Tudo sob /admin/* : sessão web + papel ADMIN. */
export const SoAdmin = () => applyDecorators(UseGuards(JwtGuard, PapelGuard), Papel('ADMIN'));
