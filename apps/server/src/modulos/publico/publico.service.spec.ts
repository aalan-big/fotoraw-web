import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PublicoService } from './publico.service.js';
import { GaleriasPublicasRepositorio } from './repositorios/galerias-publicas.repositorio.js';

describe('PublicoService', () => {
  it('monta capaUrl a partir da chave e devolve os campos da vitrine', async () => {
    const repo = {
      listarVitrine: vi.fn().mockResolvedValue([
        {
          id: '1',
          titulo: 'Corrida',
          slug: 'corrida',
          modalidade: 'EVENTO',
          visibilidade: 'PUBLICA',
          categoria: 'CORRIDA_RUA',
          dataEvento: new Date('2026-08-30'),
          cidade: 'Curitiba',
          uf: 'PR',
          precoFotoCentavos: 1500,
          capaKey: 'capas/corrida.jpg',
          totalFotos: 42,
          publicadaEm: new Date('2026-09-01'),
          conta: { nome: 'Estúdio Luz', slug: 'estudio-luz' },
        },
      ]),
    };
    const modulo = await Test.createTestingModule({
      providers: [
        PublicoService,
        { provide: GaleriasPublicasRepositorio, useValue: repo },
        { provide: ConfigService, useValue: { get: () => 'http://cdn/previews' } },
      ],
    }).compile();

    const resultado = await modulo.get(PublicoService).listarGalerias({ limite: 12 });

    expect(repo.listarVitrine).toHaveBeenCalledWith({ limite: 12 });
    expect(resultado).toEqual([
      expect.objectContaining({
        id: '1',
        totalFotos: 42,
        conta: { nome: 'Estúdio Luz', slug: 'estudio-luz' },
      }),
    ]);
    expect(resultado[0]).not.toHaveProperty('capaKey');
  });
});
