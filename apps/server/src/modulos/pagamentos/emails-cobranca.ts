import type { Email } from '../../infra/email/email.service.js';

export function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function layout(
  titulo: string,
  corpo: string,
  link: string,
  rotuloBotao: string,
  detalhes?: { rotulo: string; valor: string }[],
): string {
  const tabelaDetalhes = detalhes && detalhes.length > 0
    ? `<div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px;margin:20px 0">
        ${detalhes
          .map(
            (d) =>
              `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:14px">
                <span style="color:#666">${escapeHtml(d.rotulo)}:</span>
                <strong style="color:#111">${escapeHtml(d.valor)}</strong>
              </div>`,
          )
          .join('')}
      </div>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222;max-width:540px;margin:32px auto;padding:0 16px;background:#ffffff">
  <div style="border-bottom:2px solid #7a1f2b;padding-bottom:12px;margin-bottom:24px">
    <span style="font-size:20px;font-weight:700;color:#7a1f2b;letter-spacing:-0.5px">FotoRAW</span>
  </div>

  <h2 style="margin:0 0 16px;font-size:20px;color:#111;line-height:1.3">${escapeHtml(titulo)}</h2>
  <div style="line-height:1.6;font-size:15px;color:#333">${corpo}</div>

  ${tabelaDetalhes}

  <p style="margin:28px 0">
    <a href="${link}" style="background:#7a1f2b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;font-size:14px">
      ${escapeHtml(rotuloBotao)}
    </a>
  </p>

  <p style="font-size:12px;color:#777;line-height:1.5;margin-top:28px;border-top:1px solid #eee;padding-top:16px">
    Se o botão não funcionar, copie e cole o link no navegador:<br>
    <a href="${link}" style="color:#7a1f2b;word-break:break-all">${link}</a>
  </p>

  <p style="font-size:11px;color:#999;margin-top:24px">
    FotoRAW · Plataforma para fotógrafos profissionais<br>
    Este é um e-mail transacional referente à sua assinatura.
  </p>
</body>
</html>`;
}

export function emailPagamentoConfirmado(dados: {
  para: string;
  nome: string;
  planoNome: string;
  valorFormatado: string;
  validaAteFormatado: string;
  linkPainel: string;
}): Email {
  const nomeEscapado = escapeHtml(dados.nome);
  const planoEscapado = escapeHtml(dados.planoNome);

  const corpo = `Olá, <strong>${nomeEscapado}</strong>!<br><br>
Seu pagamento foi confirmado e os recursos do plano <strong>${planoEscapado}</strong> já estão liberados na sua conta.`;

  const detalhes = [
    { rotulo: 'Plano', valor: dados.planoNome },
    { rotulo: 'Valor pago', valor: dados.valorFormatado },
    { rotulo: 'Válido até', valor: dados.validaAteFormatado },
    { rotulo: 'Status', valor: 'Ativo' },
  ];

  return {
    para: dados.para,
    assunto: `Pagamento confirmado · Seu plano ${dados.planoNome} está liberado!`,
    html: layout(
      `Pagamento Confirmado! 🎉`,
      corpo,
      dados.linkPainel,
      'Acessar Meu Painel',
      detalhes,
    ),
    texto: `Olá, ${dados.nome}!\n\nSeu pagamento de ${dados.valorFormatado} para o plano ${dados.planoNome} foi confirmado.\nSua assinatura está ativa e válida até ${dados.validaAteFormatado}.\n\nAcesse o painel: ${dados.linkPainel}`,
  };
}

export function emailCartaoRecusado(dados: {
  para: string;
  nome: string;
  planoNome: string;
  valorFormatado: string;
  linkTrocarCartao: string;
}): Email {
  const nomeEscapado = escapeHtml(dados.nome);
  const planoEscapado = escapeHtml(dados.planoNome);

  const corpo = `Olá, <strong>${nomeEscapado}</strong>.<br><br>
A operadora do seu cartão recusou a cobrança referente à assinatura do plano <strong>${planoEscapado}</strong>.<br><br>
Para não perder o acesso às suas galerias ativas e aos limites do plano, atualize os dados do seu cartão no painel. O Mercado Pago fará novas tentativas automáticas.`;

  const detalhes = [
    { rotulo: 'Plano', valor: dados.planoNome },
    { rotulo: 'Valor da tentativa', valor: dados.valorFormatado },
    { rotulo: 'Situação', valor: 'Pagamento recusado pela operadora' },
  ];

  return {
    para: dados.para,
    assunto: `Aviso: cobrança não autorizada no plano ${dados.planoNome}`,
    html: layout(
      `Pagamento não autorizado`,
      corpo,
      dados.linkTrocarCartao,
      'Atualizar Dados do Cartão',
      detalhes,
    ),
    texto: `Olá, ${dados.nome}.\n\nA cobrança de ${dados.valorFormatado} para o plano ${dados.planoNome} não foi aprovada pelo cartão.\nAtualize seu cartão para evitar interrupções no plano:\n${dados.linkTrocarCartao}`,
  };
}

export function emailPlanoPreVencimento(dados: {
  para: string;
  nome: string;
  planoNome: string;
  dias: number;
  venceEmFormatado: string;
  linkPainel: string;
}): Email {
  const nomeEscapado = escapeHtml(dados.nome);
  const planoEscapado = escapeHtml(dados.planoNome);

  const corpo = `Olá, <strong>${nomeEscapado}</strong>.<br><br>
Este é um lembrete de que o período atual do seu plano <strong>${planoEscapado}</strong> encerra em <strong>${dados.dias} dias</strong> (${escapeHtml(dados.venceEmFormatado)}).<br><br>
Para continuar aproveitando todas as funcionalidades e limites do plano sem interrupções, verifique sua assinatura e realize a renovação pelo painel.`;

  const detalhes = [
    { rotulo: 'Plano', valor: dados.planoNome },
    { rotulo: 'Data de vencimento', valor: dados.venceEmFormatado },
  ];

  return {
    para: dados.para,
    assunto: `Seu plano ${dados.planoNome} vence em ${dados.dias} dias`,
    html: layout(
      `Seu plano vence em ${dados.dias} dias`,
      corpo,
      dados.linkPainel,
      'Ver Detalhes do Plano',
      detalhes,
    ),
    texto: `Olá, ${dados.nome}.\n\nSeu plano ${dados.planoNome} vence em ${dados.dias} dias (${dados.venceEmFormatado}).\nConfira os detalhes no seu painel: ${dados.linkPainel}`,
  };
}

export function emailPlanoVencido(dados: {
  para: string;
  nome: string;
  planoNome: string;
  linkRenovar: string;
}): Email {
  const nomeEscapado = escapeHtml(dados.nome);
  const planoEscapado = escapeHtml(dados.planoNome);

  const corpo = `Olá, <strong>${nomeEscapado}</strong>.<br><br>
O período contratado da sua assinatura do plano <strong>${planoEscapado}</strong> chegou ao fim e a renovação ainda não foi confirmada.<br><br>
Para evitar a suspensão dos recursos e limites do seu plano, acesse o painel e regularize o pagamento da sua assinatura.`;

  const detalhes = [
    { rotulo: 'Plano', valor: dados.planoNome },
    { rotulo: 'Situação', valor: 'Aguardando renovação' },
  ];

  return {
    para: dados.para,
    assunto: `Aviso: renovação pendente do plano ${dados.planoNome}`,
    html: layout(
      `Renovação Pendente`,
      corpo,
      dados.linkRenovar,
      'Renovar Meu Plano Agora',
      detalhes,
    ),
    texto: `Olá, ${dados.nome}.\n\nO período do seu plano ${dados.planoNome} chegou ao fim e a renovação está pendente.\nAcesse o painel para regularizar sua assinatura e manter todos os seus benefícios ativos:\n${dados.linkRenovar}`,
  };
}

export function emailPlanoCancelado(dados: {
  para: string;
  nome: string;
  planoNome: string;
  terminaEmFormatado?: string | null;
  noFimDoPeriodo: boolean;
  linkPainel: string;
}): Email {
  const nomeEscapado = escapeHtml(dados.nome);
  const planoEscapado = escapeHtml(dados.planoNome);

  const corpo = dados.noFimDoPeriodo && dados.terminaEmFormatado
    ? `Olá, <strong>${nomeEscapado}</strong>.<br><br>
Confirmamos o pedido de cancelamento da assinatura do plano <strong>${planoEscapado}</strong>.<br><br>
Você continuará com todos os benefícios e limites do plano ativos até <strong>${escapeHtml(dados.terminaEmFormatado)}</strong> (fim do ciclo já pago). Após essa data, sua conta passará para o plano Gratuito e nenhuma nova cobrança será realizada.`
    : `Olá, <strong>${nomeEscapado}</strong>.<br><br>
Confirmamos o cancelamento da sua assinatura do plano <strong>${planoEscapado}</strong>.<br><br>
Sua conta retornou ao plano Gratuito. Todas as suas fotos existentes continuam salvas com segurança.`;

  const detalhes = [
    { rotulo: 'Plano', valor: dados.planoNome },
    {
      rotulo: 'Vigência',
      valor: dados.noFimDoPeriodo && dados.terminaEmFormatado
        ? `Ativo até ${dados.terminaEmFormatado}`
        : 'Cancelado imediatamente',
    },
  ];

  return {
    para: dados.para,
    assunto: `Cancelamento do plano ${dados.planoNome}`,
    html: layout(
      `Assinatura Cancelada`,
      corpo,
      dados.linkPainel,
      'Acessar Painel',
      detalhes,
    ),
    texto: `Olá, ${dados.nome}.\n\nConfirmamos o cancelamento do plano ${dados.planoNome}.\n${
      dados.noFimDoPeriodo && dados.terminaEmFormatado
        ? `Seus benefícios continuam válidos até ${dados.terminaEmFormatado}.`
        : 'Sua conta retornou ao plano Gratuito.'
    }\n\nAcesse o painel: ${dados.linkPainel}`,
  };
}
