// Cria (ou promove) uma conta ADMIN. O admin nunca nasce pelo cadastro público.
//
//   pnpm admin:criar --nome "Alan" --email alan@fotoraw.com.br --senha "uma frase longa"
//
// Se o e-mail já existir, a conta é promovida a ADMIN (e a senha trocada, se informada).
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { argon2id, hash } from 'argon2';
import { PrismaClient } from '../src/infra/prisma/gerado/client.js';

const { values } = parseArgs({
  options: {
    nome: { type: 'string' },
    email: { type: 'string' },
    senha: { type: 'string' },
  },
});

if (!values.email || (!values.senha && !values.nome)) {
  console.error('uso: pnpm admin:criar --nome "Nome" --email email@dominio --senha "senha (min 8)"');
  process.exit(1);
}
const email = values.email.trim().toLowerCase();
if (values.senha && values.senha.length < 8) {
  console.error('senha: mínimo 8 caracteres');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const senhaHash = values.senha
  ? await hash(values.senha, { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 })
  : undefined;

const existente = await prisma.conta.findUnique({ where: { email } });
if (existente) {
  await prisma.conta.update({
    where: { id: existente.id },
    data: {
      papel: 'ADMIN',
      status: 'ATIVA',
      excluidoEm: null,
      emailVerificadoEm: existente.emailVerificadoEm ?? new Date(),
      ...(values.nome ? { nome: values.nome } : {}),
      ...(senhaHash ? { senhaHash } : {}),
    },
  });
  console.log(`conta ${email} promovida a ADMIN${senhaHash ? ' (senha atualizada)' : ''}`);
} else {
  if (!values.nome || !senhaHash) {
    console.error('conta nova precisa de --nome e --senha');
    process.exit(1);
  }
  const conta = await prisma.conta.create({
    data: {
      nome: values.nome,
      email,
      senhaHash,
      // admin não tem página pública; o slug só existe porque a coluna é obrigatória
      slug: `admin-${Math.random().toString(36).slice(2, 8)}`,
      papel: 'ADMIN',
      emailVerificadoEm: new Date(),
    },
  });
  console.log(`admin criado: ${conta.email} (${conta.id})`);
}
await prisma.$disconnect();
