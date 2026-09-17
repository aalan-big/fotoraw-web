export function formatarMoeda(valor: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(valor),
  );
}

export function formatarData(data: string | Date, opcoes: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', ...opcoes }).format(
    new Date(data),
  );
}

/** Iniciais pra avatar/capa sem imagem: "Estúdio Luz" → "EL" */
export function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
