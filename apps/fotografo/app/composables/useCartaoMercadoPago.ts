declare global {
  interface Window {
    // SDK do MP carregado por <script>; sem tipos oficiais
    MercadoPago?: new (chave: string, opcoes: { locale: string }) => {
      bricks: () => {
        create: (tipo: string, alvo: string, config: unknown) => Promise<{ unmount: () => Promise<void> }>;
      };
    };
  }
}

export interface CartaoTokenizado {
  token: string;
  email: string;
}

let sdk: Promise<void> | null = null;

/** O SDK entra uma vez por sessão (mesmo esquema do SeuPercurso). */
function carregarSdk(): Promise<void> {
  if (sdk) return sdk;
  sdk = new Promise((resolve, reject) => {
    if (window.MercadoPago) return resolve();
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdk = null;
      reject(new Error('Não foi possível carregar o Mercado Pago. Verifique sua conexão.'));
    };
    document.head.appendChild(script);
  });
  return sdk;
}

/**
 * Card Payment Brick do Mercado Pago: o formulário de cartão roda dentro da página e
 * devolve só um token — número, validade e CVV nunca passam pelo servidor do FotoRAW.
 */
export function useCartaoMercadoPago() {
  let controle: { unmount: () => Promise<void> } | null = null;

  async function montar(opcoes: {
    /** id do elemento, sem `#` (o SDK recusa seletor) */
    container: string;
    chavePublica: string;
    valor: number;
    email?: string;
    onCartao: (cartao: CartaoTokenizado) => Promise<void>;
    onErro: (mensagem: string) => void;
  }) {
    try {
      await carregarSdk();
      await desmontar();
      const mp = new window.MercadoPago!(opcoes.chavePublica, { locale: 'pt-BR' });
      controle = await mp.bricks().create('cardPayment', opcoes.container, {
        initialization: {
          amount: Number(opcoes.valor.toFixed(2)),
          ...(opcoes.email ? { payer: { email: opcoes.email } } : {}),
        },
        customization: {
          // mensalidade: sempre à vista, só crédito
          paymentMethods: { maxInstallments: 1, types: { excluded: ['debit_card'] } },
          visual: { style: { theme: 'dark' } },
        },
        callbacks: {
          onReady: () => {},
          onSubmit: async (dados: { token: string; payer?: { email?: string } }) => {
            await opcoes.onCartao({ token: dados.token, email: dados.payer?.email || opcoes.email || '' });
          },
          onError: (erro: { message?: string }) => {
            opcoes.onErro(erro?.message || 'Não foi possível processar o cartão. Confira os dados.');
          },
        },
      });
    } catch (erro) {
      opcoes.onErro(
        `Não foi possível abrir o formulário de cartão: ${(erro as Error)?.message ?? 'tente de novo'}`,
      );
    }
  }

  async function desmontar() {
    try {
      await controle?.unmount();
    } catch {
      // já removido
    }
    controle = null;
  }

  onBeforeUnmount(desmontar);
  return { montar, desmontar };
}
