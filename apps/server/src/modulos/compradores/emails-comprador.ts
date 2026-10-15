import type { Email } from '../../infra/email/email.service.js';

/** Código de 6 dígitos pra entrar em "Minhas fotos". Sem botão: o código vai digitado. */
export function emailCodigoComprador(dados: { para: string; codigo: string }): Email {
  return {
    para: dados.para,
    assunto: `${dados.codigo} é seu código do FotoRAW`,
    html: `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222;max-width:480px;margin:32px auto;padding:0 16px;background:#ffffff">
  <div style="border-bottom:2px solid #7a1f2b;padding-bottom:12px;margin-bottom:24px">
    <span style="font-size:20px;font-weight:700;color:#7a1f2b;letter-spacing:-0.5px">FotoRAW</span>
  </div>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px">Use este código pra entrar em <strong>Minhas fotos</strong>:</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:0 0 16px;color:#111">${dados.codigo}</p>
  <p style="font-size:13px;color:#666;line-height:1.5;margin:0">Vale por 15 minutos. Se não foi você que pediu, é só ignorar este e-mail.</p>
</body>
</html>`,
    texto: `Seu código do FotoRAW: ${dados.codigo} (vale por 15 minutos).`,
  };
}
