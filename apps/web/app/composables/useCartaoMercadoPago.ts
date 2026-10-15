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

/** O que o Brick devolve e o server repassa ao MP — nunca o número do cartão. */
export interface CartaoTokenizado {
  token: string;
  paymentMethodId: string;
  issuerId?: string | number;
  parcelas: number;
  email: string;
  cpf: string;
}

let sdk: Promise<void> | null = null;

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
 * Card Payment Brick na vitrine. Igual ao do painel (apps/fotografo), mas com a
 * public_key do FOTÓGRAFO: o pagamento é criado na conta dele (split do FotoRAW).
 * Número, validade e CVV ficam no formulário do MP — chega aqui só o token.
 */
export function useCartaoMercadoPago() {
  let controle: { unmount: () => Promise<void> } | null = null;

  async function montar(opcoes: {
    /** id do elemento, sem `#` */
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
          // foto custa pouco: à vista, crédito
          paymentMethods: { maxInstallments: 1, types: { excluded: ['debit_card'] } },
          visual: { style: { theme: 'dark' } },
        },
        callbacks: {
          onReady: () => {},
          onSubmit: async (dados: {
            token: string;
            payment_method_id: string;
            issuer_id?: string | number;
            installments?: number;
            payer?: { email?: string; identification?: { number?: string } };
          }) => {
            await opcoes.onCartao({
              token: dados.token,
              paymentMethodId: dados.payment_method_id,
              issuerId: dados.issuer_id,
              parcelas: dados.installments ?? 1,
              email: dados.payer?.email || opcoes.email || '',
              cpf: dados.payer?.identification?.number ?? '',
            });
          },
          onError: (erro: { message?: string }) => {
            opcoes.onErro(erro?.message || 'Não foi possível processar o cartão. Confira os dados.');
          },
        },
      });
    } catch (erro) {
      opcoes.onErro(`Não foi possível abrir o formulário de cartão: ${(erro as Error)?.message ?? 'tente de novo'}`);
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
