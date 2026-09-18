import { z } from 'zod';

/** Sempre minúsculo e sem espaços — `contas.email` é único nesse formato. */
export const emailSchema = z.email('E-mail inválido').trim().toLowerCase().max(160);

/** Mínimo 8 (a checagem contra senhas comuns é no service). */
export const senhaSchema = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres')
  .max(128, 'A senha pode ter no máximo 128 caracteres');

/** Handle público: fotoraw.com.br/@slug. 3–30 chars, minúsculo, sem começar/terminar com hífen. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/, 'Use de 3 a 30 letras, números ou hífen');

/** Rotas que não podem virar slug de fotógrafo. */
export const SLUGS_RESERVADOS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'conta',
  'contas',
  'entrar',
  'sair',
  'cadastro',
  'criar-conta',
  'eventos',
  'ensaio',
  'ensaios',
  'galeria',
  'galerias',
  'foto',
  'fotos',
  'fotografo',
  'fotografos',
  'fotoraw',
  'suporte',
  'ajuda',
  'termos',
  'privacidade',
  'planos',
  'plano',
  'precos',
  'blog',
  'sobre',
  'contato',
  'busca',
  'pedido',
  'pedidos',
  'carrinho',
  'checkout',
  'pagamento',
  'download',
  'downloads',
  'publico',
  'static',
  'assets',
  'www',
  'mail',
  'email',
  'null',
  'undefined',
]);
