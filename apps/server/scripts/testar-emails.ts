// Dispara os e-mails de cobrança para um endereço de teste via Resend.
//
//   pnpm --filter server exec tsx scripts/testar-emails.ts --email seu@email.com
//   pnpm --filter server exec tsx scripts/testar-emails.ts --email seu@email.com --tipo recusado
//
import 'dotenv/config';
import { parseArgs } from 'node:util';
import {
  emailCartaoRecusado,
  emailPagamentoConfirmado,
  emailPlanoCancelado,
  emailPlanoPreVencimento,
  emailPlanoVencido,
} from '../src/modulos/pagamentos/emails-cobranca.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    nome: { type: 'string', default: 'Fotógrafo Teste' },
    tipo: { type: 'string', default: 'todos' },
  },
});

if (!values.email) {
  console.error('Uso: pnpm --filter server exec tsx scripts/testar-emails.ts --email seu@email.com [--tipo todos|pago|recusado|3dias|vencido|cancelado]');
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
const remetente = process.env.EMAIL_REMETENTE || 'FotoRAW <nao-responda@fotoraw.com.br>';
const painelUrl = process.env.FOTOGRAFO_URL || 'https://painel.fotoraw.com.br';

console.log(`\n📧 Disparando e-mails de teste para: ${values.email}`);
console.log(`Remetente: ${remetente}`);
console.log(`Resend API Key: ${apiKey ? apiKey.slice(0, 8) + '...' : '(NÃO DEFINIDA - só simula)'}\n`);

async function enviar(emailObj: { para: string; assunto: string; html: string; texto?: string }) {
  console.log(`-> Enviando: "${emailObj.assunto}"`);
  if (!apiKey) {
    console.log(`   [Simulação - defina RESEND_API_KEY para envio real]`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: remetente,
      to: [emailObj.para],
      subject: emailObj.assunto,
      html: emailObj.html,
      text: emailObj.texto,
    }),
  });
  if (res.ok) {
    const data = await res.json();
    console.log(`   ✅ Enviado com sucesso! ID: ${data.id}`);
  } else {
    console.error(`   ❌ Falha ao enviar (${res.status}): ${await res.text()}`);
  }
}

const tipo = values.tipo?.toLowerCase() ?? 'todos';
const destino = values.email.trim().toLowerCase();
const nome = values.nome ?? 'Fotógrafo Teste';

if (tipo === 'todos' || tipo === 'pago') {
  await enviar(
    emailPagamentoConfirmado({
      para: destino,
      nome,
      planoNome: 'FotoRAW PRO',
      valorFormatado: 'R$ 59,90',
      validaAteFormatado: '14/11/2026',
      linkPainel: `${painelUrl}/plano`,
    }),
  );
}

if (tipo === 'todos' || tipo === 'recusado') {
  await enviar(
    emailCartaoRecusado({
      para: destino,
      nome,
      planoNome: 'FotoRAW PRO',
      valorFormatado: 'R$ 59,90',
      linkTrocarCartao: `${painelUrl}/plano`,
    }),
  );
}

if (tipo === 'todos' || tipo === '3dias') {
  await enviar(
    emailPlanoPreVencimento({
      para: destino,
      nome,
      planoNome: 'FotoRAW PRO',
      dias: 3,
      venceEmFormatado: '17/10/2026',
      linkPainel: `${painelUrl}/plano`,
    }),
  );
}

if (tipo === 'todos' || tipo === 'vencido') {
  await enviar(
    emailPlanoVencido({
      para: destino,
      nome,
      planoNome: 'FotoRAW PRO',
      linkRenovar: `${painelUrl}/plano`,
    }),
  );
}

if (tipo === 'todos' || tipo === 'cancelado') {
  await enviar(
    emailPlanoCancelado({
      para: destino,
      nome,
      planoNome: 'FotoRAW PRO',
      terminaEmFormatado: '14/11/2026',
      noFimDoPeriodo: true,
      linkPainel: `${painelUrl}/plano`,
    }),
  );
}

console.log('\nPronto!\n');
