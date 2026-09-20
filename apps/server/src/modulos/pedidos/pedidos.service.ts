import { Injectable, NotFoundException } from '@nestjs/common';
import { StorageService } from '../../infra/storage/storage.service.js';
import type { ExportarCsvDto, ListarPedidosDto } from './dto/pedidos.dto.js';
import { PedidosRepositorio } from './repositorios/pedidos.repositorio.js';

function formatarCentavosParaReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

function dataHoraFormatada(data: Date): string {
  return data.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function escaparCsv(texto: string | null | undefined): string {
  if (!texto) return '';
  const limpo = texto.replace(/"/g, '""');
  return limpo.includes(';') || limpo.includes('\n') || limpo.includes('"')
    ? `"${limpo}"`
    : limpo;
}

@Injectable()
export class PedidosService {
  constructor(
    private readonly repositorio: PedidosRepositorio,
    private readonly storage: StorageService,
  ) {}

  async listar(contaId: string, filtro: ListarPedidosDto) {
    const resultado = await this.repositorio.listar(contaId, filtro);

    return {
      itens: resultado.itens.map((p) => ({
        id: p.id,
        numero: p.numero,
        galeriaId: p.galeriaId,
        galeriaTitulo: p.galeria.titulo,
        compradorNome: p.comprador.nome,
        compradorEmail: p.comprador.email,
        compradorWhatsapp: p.comprador.whatsapp,
        totalItens: p.itens.length,
        subtotalCentavos: p.subtotalCentavos,
        descontoCentavos: p.descontoCentavos,
        taxaClienteCentavos: p.taxaClienteCentavos,
        totalCentavos: p.totalCentavos,
        comissaoPct: Number(p.comissaoPct),
        comissaoCentavos: p.comissaoCentavos,
        taxaProvedorCentavos: p.taxaProvedorCentavos,
        repasseCentavos: p.repasseCentavos,
        status: p.status,
        metodoPagamento: p.pagamentos[0]?.metodo ?? null,
        pagoEm: p.pagoEm ? p.pagoEm.toISOString() : null,
        criadoEm: p.criadoEm.toISOString(),
      })),
      total: resultado.total,
      pagina: resultado.pagina,
      limite: resultado.limite,
    };
  }

  async obterPorNumero(numero: number, contaId: string) {
    const p = await this.repositorio.porNumero(numero, contaId);
    if (!p) {
      throw new NotFoundException(`Pedido #${numero} não encontrado`);
    }

    const mapaDownloads = new Map(p.downloads.map((d) => [d.fotoId, d]));

    return {
      id: p.id,
      numero: p.numero,
      galeriaId: p.galeriaId,
      galeriaTitulo: p.galeria.titulo,
      galeriaSlug: p.galeria.slug,
      subtotalCentavos: p.subtotalCentavos,
      descontoCentavos: p.descontoCentavos,
      taxaClienteCentavos: p.taxaClienteCentavos,
      totalCentavos: p.totalCentavos,
      comissaoPct: Number(p.comissaoPct),
      comissaoCentavos: p.comissaoCentavos,
      taxaProvedorCentavos: p.taxaProvedorCentavos,
      repasseCentavos: p.repasseCentavos,
      status: p.status,
      metodoPagamento: p.pagamentos[0]?.metodo ?? null,
      pagoEm: p.pagoEm ? p.pagoEm.toISOString() : null,
      criadoEm: p.criadoEm.toISOString(),
      comprador: {
        id: p.comprador.id,
        nome: p.comprador.nome,
        email: p.comprador.email,
        whatsapp: p.comprador.whatsapp,
        cpf: p.comprador.cpf,
      },
      itens: p.itens.map((i) => {
        const download = mapaDownloads.get(i.fotoId);
        return {
          id: i.id,
          fotoId: i.fotoId,
          fotoIdDesktop: i.foto.fotoIdDesktop,
          previewUrl: this.storage.urlPublicaPreview(i.foto.previewKey),
          numeroIdentificacao: i.foto.numeroIdentificacao,
          precoCentavos: i.precoCentavos,
          incluida: i.incluida,
          downloadsRestantes: download
            ? Math.max(0, download.limiteBaixadas - download.baixadas)
            : undefined,
          limiteDownloads: download ? download.limiteBaixadas : undefined,
        };
      }),
      pagamentos: p.pagamentos.map((pag) => ({
        id: pag.id,
        metodo: pag.metodo,
        status: pag.status,
        valorCentavos: pag.valorCentavos,
        pixCopiaCola: pag.pixCopiaCola,
        aprovadoEm: pag.aprovadoEm ? pag.aprovadoEm.toISOString() : null,
        criadoEm: pag.criadoEm.toISOString(),
      })),
    };
  }

  async obterMetricas(contaId: string) {
    return this.repositorio.metricas(contaId);
  }

  /**
   * Gera o arquivo CSV com BOM (\uFEFF) para garantir abertura direta em UTF-8 no Excel.
   */
  async gerarCsv(contaId: string, filtro: ExportarCsvDto): Promise<string> {
    const pedidos = await this.repositorio.listarTodosParaCsv(contaId, filtro);

    const cabecalhos = [
      'Pedido',
      'Data/Hora',
      'Status',
      'Galeria',
      'Comprador',
      'E-mail',
      'WhatsApp',
      'Qtd Fotos',
      'Subtotal (R$)',
      'Taxa Cliente (R$)',
      'Total Pago (R$)',
      'Comissão FotoRAW (R$)',
      'Repasse Líquido (R$)',
      'Método de Pagamento',
    ];

    const linhas = pedidos.map((p) => [
      `#${p.numero}`,
      dataHoraFormatada(p.criadoEm),
      p.status,
      escaparCsv(p.galeria.titulo),
      escaparCsv(p.comprador.nome),
      escaparCsv(p.comprador.email),
      escaparCsv(p.comprador.whatsapp),
      p.itens.length,
      formatarCentavosParaReais(p.subtotalCentavos),
      formatarCentavosParaReais(p.taxaClienteCentavos),
      formatarCentavosParaReais(p.totalCentavos),
      formatarCentavosParaReais(p.comissaoCentavos),
      formatarCentavosParaReais(p.repasseCentavos),
      p.pagamentos[0]?.metodo ?? '—',
    ]);

    const conteudo = [cabecalhos.join(';'), ...linhas.map((l) => l.join(';'))].join('\r\n');

    // Caractere BOM para suporte nativo a UTF-8 no Excel
    return `\uFEFF${conteudo}`;
  }
}
