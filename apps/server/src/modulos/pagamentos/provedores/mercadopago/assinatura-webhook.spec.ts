import { createHmac } from 'node:crypto';
import { assinaturaWebhookValida } from './assinatura-webhook.js';

const segredo = 'segredo-de-teste';
const assinar = (manifesto: string) => createHmac('sha256', segredo).update(manifesto).digest('hex');

describe('assinaturaWebhookValida (x-signature do Mercado Pago)', () => {
  it('aceita o HMAC do manifesto id;request-id;ts', () => {
    const v1 = assinar('id:123456;request-id:req-1;ts:1704908010;');
    expect(
      assinaturaWebhookValida({
        segredo,
        xSignature: `ts=1704908010,v1=${v1}`,
        xRequestId: 'req-1',
        dataId: '123456',
      }),
    ).toBe(true);
  });

  it('aceita data.id alfanumérico assinado em minúsculas', () => {
    const v1 = assinar('id:2c938084abcd;request-id:req-2;ts:99;');
    expect(
      assinaturaWebhookValida({
        segredo,
        xSignature: `ts=99, v1=${v1}`,
        xRequestId: 'req-2',
        dataId: '2C938084ABCD',
      }),
    ).toBe(true);
  });

  it('tira do manifesto a parte que não veio', () => {
    const v1 = assinar('id:7;ts:5;');
    expect(
      assinaturaWebhookValida({ segredo, xSignature: `ts=5,v1=${v1}`, xRequestId: undefined, dataId: '7' }),
    ).toBe(true);
  });

  it('recusa assinatura de outro segredo, id trocado, header faltando ou malformado', () => {
    const v1 = assinar('id:1;request-id:r;ts:1;');
    const base = { segredo, xSignature: `ts=1,v1=${v1}`, xRequestId: 'r', dataId: '1' };
    expect(assinaturaWebhookValida({ ...base, segredo: 'outro' })).toBe(false);
    expect(assinaturaWebhookValida({ ...base, dataId: '2' })).toBe(false);
    expect(assinaturaWebhookValida({ ...base, xSignature: undefined })).toBe(false);
    expect(assinaturaWebhookValida({ ...base, xSignature: 'ts=1,v1=zz' })).toBe(false);
    expect(assinaturaWebhookValida({ ...base, segredo: '' })).toBe(false);
  });
});
