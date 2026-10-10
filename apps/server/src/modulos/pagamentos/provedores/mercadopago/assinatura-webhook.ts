import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Confere a "assinatura secreta" do webhook do MP. O header `x-signature` vem como
 * `ts=<timestamp>,v1=<hmac>`; o HMAC-SHA256 (hex) é do manifesto
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com a chave do painel. Parte sem valor
 * sai do manifesto. A doc pede `data.id` alfanumérico em minúsculas: aceitamos as duas formas.
 */
export function assinaturaWebhookValida(dados: {
  segredo: string;
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
}): boolean {
  const { segredo, xSignature, xRequestId, dataId } = dados;
  if (!segredo || !xSignature) return false;

  const partes = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=');
      return [k, v.join('=')];
    }),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;

  const candidatos = new Set([dataId, dataId?.toLowerCase()]);
  for (const id of candidatos) {
    const manifesto =
      (id ? `id:${id};` : '') + (xRequestId ? `request-id:${xRequestId};` : '') + `ts:${ts};`;
    const esperado = createHmac('sha256', segredo).update(manifesto).digest();
    if (timingSafeEqual(esperado, Buffer.from(v1, 'hex'))) return true;
  }
  return false;
}
