import type { Email } from '../../infra/email/email.service.js';

/** Textos dos e-mails do auth. Simples e em texto + HTML mínimo — sem template engine. */

function layout(titulo: string, corpo: string, link: string, rotulo: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="font-family:system-ui,sans-serif;color:#222;max-width:520px;margin:32px auto;padding:0 16px">
<h2 style="margin:0 0 16px">${titulo}</h2>
<p style="line-height:1.5">${corpo}</p>
<p style="margin:24px 0"><a href="${link}" style="background:#7a1f2b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">${rotulo}</a></p>
<p style="font-size:13px;color:#666">Se o botão não abrir, copie este endereço:<br>${link}</p>
<p style="font-size:12px;color:#999;margin-top:32px">FotoRAW · se você não pediu isto, ignore este e-mail.</p>
</body></html>`;
}

export function emailVerificarConta(para: string, nome: string, link: string): Email {
  return {
    para,
    assunto: 'Confirme seu e-mail no FotoRAW',
    html: layout(
      `Olá, ${nome}!`,
      'Falta só confirmar seu e-mail pra publicar galerias e receber vendas.',
      link,
      'Confirmar e-mail',
    ),
    texto: `Olá, ${nome}! Confirme seu e-mail no FotoRAW: ${link}`,
  };
}

export function emailRedefinirSenha(para: string, nome: string, link: string): Email {
  return {
    para,
    assunto: 'Redefinir sua senha do FotoRAW',
    html: layout(
      `Olá, ${nome}`,
      'Recebemos um pedido pra redefinir sua senha. O link vale por 30 minutos.',
      link,
      'Escolher nova senha',
    ),
    texto: `Olá, ${nome}. Redefina sua senha do FotoRAW (vale 30 min): ${link}`,
  };
}

export function emailConfirmarTroca(para: string, nome: string, link: string): Email {
  return {
    para,
    assunto: 'Confirme seu novo e-mail no FotoRAW',
    html: layout(
      `Olá, ${nome}`,
      'Você pediu pra trocar o e-mail da sua conta. Confirme que este endereço é seu.',
      link,
      'Confirmar novo e-mail',
    ),
    texto: `Olá, ${nome}. Confirme seu novo e-mail no FotoRAW: ${link}`,
  };
}
