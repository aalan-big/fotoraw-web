import { describe, expect, it } from 'vitest';
import { decidirAviso, lerDisco, nivelDoUso, type EstadoVigia } from './vigia-disco.service.js';

const uso = (usoPct: number) => ({ usoPct, livreGb: 9.5, totalGb: 96 });
const normal: EstadoVigia = { nivel: 'normal', avisadoEm: null };
const HORA = 60 * 60 * 1000;

describe('vigia de disco', () => {
  it('classifica o nível', () => {
    expect(nivelDoUso(79)).toBe('normal');
    expect(nivelDoUso(80)).toBe('alto');
    expect(nivelDoUso(90)).toBe('critico');
  });

  it('não avisa com o disco normal', () => {
    expect(decidirAviso(normal, uso(7), 0).aviso).toBeNull();
  });

  it('avisa ao passar de 80% e não repete no mesmo nível antes de 6 h', () => {
    const primeiro = decidirAviso(normal, uso(82), 0);
    expect(primeiro.aviso?.titulo).toContain('82%');
    expect(decidirAviso(primeiro.estado, uso(84), 5 * HORA).aviso).toBeNull();
    expect(decidirAviso(primeiro.estado, uso(84), 6 * HORA).aviso?.titulo).toContain('84%');
  });

  it('avisa na hora quando sobe de alto pra crítico', () => {
    const alto = decidirAviso(normal, uso(82), 0).estado;
    const critico = decidirAviso(alto, uso(91), 15 * 60 * 1000);
    expect(critico.aviso?.titulo).toContain('🚨');
    expect(critico.estado.nivel).toBe('critico');
  });

  it('avisa uma vez quando volta ao normal', () => {
    const alto = decidirAviso(normal, uso(85), 0).estado;
    const voltou = decidirAviso(alto, uso(10), HORA);
    expect(voltou.aviso?.titulo).toContain('voltou ao normal');
    expect(decidirAviso(voltou.estado, uso(10), 2 * HORA).aviso).toBeNull();
  });

  it('lê o disco da máquina', async () => {
    const d = await lerDisco(process.cwd());
    expect(d.totalGb).toBeGreaterThan(0);
    expect(d.usoPct).toBeGreaterThanOrEqual(0);
    expect(d.usoPct).toBeLessThanOrEqual(100);
  });
});
