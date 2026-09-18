import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';

export interface Email {
  para: string;
  assunto: string;
  html: string;
  texto?: string;
}

/**
 * Envio transacional pelo Resend (API HTTP, sem SDK). Sem `RESEND_API_KEY`
 * (dev/test) não envia: loga o conteúdo — o link de verificação aparece no console.
 * Nunca lança pra fora: falha de e-mail não pode derrubar um cadastro.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly remetente: string;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('RESEND_API_KEY');
    this.remetente = config.get('EMAIL_REMETENTE');
  }

  async enviar(email: Email): Promise<void> {
    if (!this.apiKey) {
      this.logger.log(
        `[e-mail não enviado] para=${email.para} assunto="${email.assunto}"\n${email.texto ?? email.html}`,
      );
      return;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.remetente,
          to: [email.para],
          subject: email.assunto,
          html: email.html,
          text: email.texto,
        }),
      });
      if (!res.ok) this.logger.error(`Resend respondeu ${res.status}: ${await res.text()}`);
    } catch (erro) {
      this.logger.error(
        `Falha ao enviar e-mail para ${email.para}`,
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }
}
