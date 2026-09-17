import { Test } from '@nestjs/testing';
import { PublicoService } from './publico.service.js';
import { GaleriasPublicasRepositorio } from './repositorios/galerias-publicas.repositorio.js';

describe('PublicoService', () => {
  it('achata _count.fotos em totalFotos', async () => {
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
          precoFoto: { toFixed: () => '15.00' },
          capaUrl: null,
          publicadaEm: new Date('2026-09-01'),
          conta: { nome: 'Estúdio Luz', slug: 'estudio-luz' },
          _count: { fotos: 42 },
        },
      ]),
    };
    const modulo = await Test.createTestingModule({
      providers: [PublicoService, { provide: GaleriasPublicasRepositorio, useValue: repo }],
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
    expect(resultado[0]).not.toHaveProperty('_count');
  });
});
