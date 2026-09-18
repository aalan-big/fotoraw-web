export { AuthModule } from './auth.module.js';
export { AuthService, type ContaPublica, type Contexto, contaPublica } from './auth.service.js';
export { ContaAtual } from './decorators/conta-atual.decorator.js';
export { Ctx } from './decorators/contexto.decorator.js';
export { Papel } from './decorators/papel.decorator.js';
export { JwtGuard } from './guards/jwt.guard.js';
export { PapelGuard } from './guards/papel.guard.js';
export type { RequisicaoAutenticada } from './guards/requisicao.js';
export { TokenApiGuard } from './guards/token-api.guard.js';
