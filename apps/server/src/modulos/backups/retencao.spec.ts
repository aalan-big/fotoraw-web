import { backupsParaApagar } from './retencao.js';

/** backup feito em `dia` (horário de Brasília) às `hora` */
function bk(id: string, dia: string, hora = '12:00') {
  return { id, concluidoEm: new Date(`${dia}T${hora}:00-03:00`) };
}

describe('retenção dos backups do desktop', () => {
  it('fica só o mais novo de cada dia', () => {
    const sair = backupsParaApagar([
      bk('manha', '2026-11-03', '08:00'),
      bk('noite', '2026-11-03', '22:00'),
      bk('ontem', '2026-11-02'),
    ]);
    expect(sair.map((b) => b.id)).toEqual(['manha']);
  });

  it('usa o dia de Brasília, não o UTC (23h em Brasília já é amanhã em UTC)', () => {
    const sair = backupsParaApagar([
      bk('23h', '2026-11-03', '23:00'),
      bk('10h', '2026-11-03', '10:00'),
    ]);
    expect(sair.map((b) => b.id)).toEqual(['10h']);
  });

  it('30 dias seguidos: ficam os 7 últimos dias + o mais novo de 4 semanas', () => {
    const backups = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 10, 30 - i));
      return bk(d.toISOString().slice(0, 10), d.toISOString().slice(0, 10));
    });
    const sair = new Set(backupsParaApagar(backups).map((b) => b.id));
    const ficam = backups.filter((b) => !sair.has(b.id)).map((b) => b.id);
    // 30/11/2026 é segunda: 7 dias (24 a 30) + domingos 22, 15 e 08 (semanas anteriores)
    expect(ficam).toEqual([
      '2026-11-30',
      '2026-11-29',
      '2026-11-28',
      '2026-11-27',
      '2026-11-26',
      '2026-11-25',
      '2026-11-24',
      '2026-11-22',
      '2026-11-15',
    ]);
  });

  it('com poucos backups não apaga nada', () => {
    expect(backupsParaApagar([bk('a', '2026-10-01'), bk('b', '2026-09-01')])).toEqual([]);
  });
});
