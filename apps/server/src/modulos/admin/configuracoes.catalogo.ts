import { z } from 'zod';

/**
 * As chaves de `configuracoes_plataforma` que o admin pode mexer, com o tipo
 * de cada uma. O banco guarda JSON solto; a validação é aqui. Chave fora
 * desta lista não é lida nem gravada pelo admin.
 */
export interface ConfiguracaoDef {
  chave: string;
  grupo: 'licencas' | 'vendas' | 'downloads' | 'contato';
  rotulo: string;
  descricao: string;
  tipo: 'inteiro' | 'percentual' | 'email';
  padrao: number | string;
  schema: z.ZodType<number | string>;
}

export const CATALOGO_CONFIGURACOES: readonly ConfiguracaoDef[] = [
  {
    chave: 'trial_dias',
    grupo: 'licencas',
    rotulo: 'Dias de trial',
    descricao: 'Quantos dias de PRO a conta ganha no cadastro.',
    tipo: 'inteiro',
    padrao: 14,
    schema: z.number().int().min(0).max(365),
  },
  {
    chave: 'comissao_padrao_pct',
    grupo: 'vendas',
    rotulo: 'Comissão padrão (%)',
    descricao: 'Percentual da plataforma nas vendas de evento quando o plano não define outro.',
    tipo: 'percentual',
    padrao: 10,
    schema: z.number().min(0).max(100),
  },
  {
    chave: 'pix_reserva_minutos',
    grupo: 'vendas',
    rotulo: 'Reserva do Pix (min)',
    descricao: 'Por quanto tempo um pedido aguardando Pix segura as fotos antes de expirar.',
    tipo: 'inteiro',
    padrao: 30,
    schema: z.number().int().min(5).max(1440),
  },
  {
    chave: 'download_dias_validade',
    grupo: 'downloads',
    rotulo: 'Validade do download (dias)',
    descricao: 'Por quantos dias o link de download de uma compra continua funcionando.',
    tipo: 'inteiro',
    padrao: 30,
    schema: z.number().int().min(1).max(3650),
  },
  {
    chave: 'download_limite_baixadas',
    grupo: 'downloads',
    rotulo: 'Limite de baixadas',
    descricao: 'Quantas vezes cada foto comprada pode ser baixada.',
    tipo: 'inteiro',
    padrao: 5,
    schema: z.number().int().min(1).max(1000),
  },
  {
    chave: 'email_contato',
    grupo: 'contato',
    rotulo: 'E-mail de contato',
    descricao: 'Aparece no rodapé da vitrine e nos e-mails automáticos.',
    tipo: 'email',
    padrao: 'contato@fotoraw.com.br',
    schema: z.email().max(120),
  },
  {
    chave: 'email_suporte',
    grupo: 'contato',
    rotulo: 'E-mail de suporte',
    descricao: 'Pra onde o fotógrafo escreve quando algo dá errado.',
    tipo: 'email',
    padrao: 'suporte@fotoraw.com.br',
    schema: z.email().max(120),
  },
];

export function definicaoDaChave(chave: string): ConfiguracaoDef | undefined {
  return CATALOGO_CONFIGURACOES.find((c) => c.chave === chave);
}
