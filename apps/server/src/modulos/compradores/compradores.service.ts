import { createHash, randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DominioExcecao } from '../../comum/excecoes/dominio.excecao.js';
import type { Env } from '../../config/env.js';
import { EmailService } from '../../infra/email/email.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { urlPublica } from '../../infra/storage/urls.js';
import type {
  AtualizarPerfilDto,
  ConfirmarCodigoDto,
  PedirCodigoDto,
} from './dto/compradores.dto.js';
import { emailCodigoComprador } from './emails-comprador.js';

const CODIGO_VALE_MS = 15 * 60 * 1000;
const TENTATIVAS_POR_CODIGO = 5;
/** no máximo N códigos por e-mail a cada 15 min (não vira spam na caixa de ninguém) */
const CODIGOS_POR_JANELA = 5;
const SESSAO = '90d';

const hash = (codigo: string) => createHash('sha256').update(codigo).digest('hex');

class CodigoInvalidoExcecao extends DominioExcecao {
  constructor(mensagem = 'Código incorreto ou vencido. Peça um novo.') {
    super('CODIGO_INVALIDO', mensagem, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * Área "Minhas fotos" do comprador — sem senha:
 * código de 6 dígitos no e-mail (vale 15 min, 5 tentativas).
 * O comprador é o mesmo do checkout (por e-mail): quem comprou como visitante e
 * depois entra vê tudo. Token próprio, com segredo separado do fotógrafo.
 */
@Injectable()
export class CompradoresService {
  private readonly segredo: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly storage: StorageService,
    config: ConfigService<Env, true>,
  ) {
    // derivado: um token de comprador nunca vale como token de fotógrafo (e vice-versa)
    this.segredo = `${config.get('JWT_SECRET')}:comprador`;
  }

  // --- entrar com código ------------------------------------------------------------

  async pedirCodigo({ email }: PedirCodigoDto) {
    const recentes = await this.prisma.codigoComprador.count({
      where: { email, criadoEm: { gt: new Date(Date.now() - CODIGO_VALE_MS) } },
    });
    if (recentes >= CODIGOS_POR_JANELA) {
      throw new DominioExcecao(
        'MUITOS_CODIGOS',
        'Já mandamos vários códigos. Confira a caixa de entrada (e o spam) ou espere 15 minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.codigoComprador.create({
      data: { email, codigoHash: hash(codigo), expiraEm: new Date(Date.now() + CODIGO_VALE_MS) },
    });
    await this.email.enviar(emailCodigoComprador({ para: email, codigo }));
    return { enviado: true };
  }

  async confirmarCodigo({ email, codigo }: ConfirmarCodigoDto) {
    const atual = await this.prisma.codigoComprador.findFirst({
      where: { email, usadoEm: null, expiraEm: { gt: new Date() } },
      orderBy: { criadoEm: 'desc' },
    });
    if (!atual || atual.tentativas >= TENTATIVAS_POR_CODIGO) throw new CodigoInvalidoExcecao();
    if (atual.codigoHash !== hash(codigo)) {
      await this.prisma.codigoComprador.update({
        where: { id: atual.id },
        data: { tentativas: { increment: 1 } },
      });
      throw new CodigoInvalidoExcecao('Código incorreto. Confira o e-mail e tente de novo.');
    }
    await this.prisma.codigoComprador.update({ where: { id: atual.id }, data: { usadoEm: new Date() } });
    return this.entrar(email);
  }

  // --- sessão -----------------------------------------------------------------------

  private async entrar(email: string) {
    const comprador = await this.prisma.comprador.upsert({
      where: { email },
      create: { email, nome: email.split('@')[0]!, ultimoAcessoEm: new Date() },
      update: { ultimoAcessoEm: new Date() },
    });
    const acesso = await this.jwt.signAsync(
      { sub: comprador.id, tipo: 'comprador' },
      { secret: this.segredo, expiresIn: SESSAO },
    );
    return { acesso, comprador: this.perfil(comprador) };
  }

  async validarToken(token: string): Promise<string | null> {
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; tipo: string }>(token, { secret: this.segredo });
      return p.tipo === 'comprador' ? p.sub : null;
    } catch {
      return null;
    }
  }

  // --- perfil e fotos ---------------------------------------------------------------

  private perfil(c: { id: string; nome: string; email: string; whatsapp: string | null; cpf: string | null }) {
    return { id: c.id, nome: c.nome, email: c.email, whatsapp: c.whatsapp, cpf: c.cpf };
  }

  async eu(compradorId: string) {
    const c = await this.prisma.comprador.findUniqueOrThrow({ where: { id: compradorId } });
    return this.perfil(c);
  }

  async atualizar(compradorId: string, dto: AtualizarPerfilDto) {
    const c = await this.prisma.comprador.update({
      where: { id: compradorId },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.whatsapp !== undefined ? { whatsapp: dto.whatsapp || null } : {}),
        ...(dto.cpf !== undefined ? { cpf: dto.cpf || null } : {}),
      },
    });
    return this.perfil(c);
  }

  /** Tudo que ele comprou (pedidos pagos), agrupado por galeria, mais recente primeiro. */
  async minhasFotos(compradorId: string) {
    const pedidos = await this.prisma.pedido.findMany({
      where: { compradorId, status: 'PAGO', galeria: { excluidoEm: null } },
      orderBy: { pagoEm: 'desc' },
      select: {
        id: true,
        numero: true,
        pagoEm: true,
        galeria: {
          select: { id: true, titulo: true, slug: true, capaKey: true, dataEvento: true, conta: { select: { slug: true, nome: true } } },
        },
        downloads: {
          select: {
            token: true,
            foto: { select: { id: true, numeroIdentificacao: true, thumbKey: true, previewKey: true } },
          },
        },
      },
    });

    const base = this.storage.urlBasePreviews;
    const porGaleria = new Map<string, {
      galeria: { id: string; titulo: string; slug: string; contaSlug: string; fotografo: string; capaUrl: string | null; dataEvento: Date | null };
      pedidos: { id: string; numero: number; pagoEm: Date | null }[];
      fotos: { fotoId: string; numero: string | null; miniaturaUrl: string | null; token: string }[];
    }>();
    for (const p of pedidos) {
      const g = p.galeria;
      let grupo = porGaleria.get(g.id);
      if (!grupo) {
        grupo = {
          galeria: {
            id: g.id,
            titulo: g.titulo,
            slug: g.slug,
            contaSlug: g.conta.slug,
            fotografo: g.conta.nome,
            capaUrl: urlPublica(base, g.capaKey),
            dataEvento: g.dataEvento,
          },
          pedidos: [],
          fotos: [],
        };
        porGaleria.set(g.id, grupo);
      }
      grupo.pedidos.push({ id: p.id, numero: p.numero, pagoEm: p.pagoEm });
      for (const d of p.downloads) {
        if (grupo.fotos.some((f) => f.fotoId === d.foto.id)) continue; // comprou a mesma foto 2x
        grupo.fotos.push({
          fotoId: d.foto.id,
          numero: d.foto.numeroIdentificacao,
          miniaturaUrl: urlPublica(base, d.foto.thumbKey ?? d.foto.previewKey),
          token: d.token,
        });
      }
    }
    return [...porGaleria.values()];
  }
}
