import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const schema = z.object({ nome: z.string().min(1), idade: z.coerce.number().int() });

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('devolve o valor já transformado quando válido', () => {
    expect(pipe.transform({ nome: 'Ana', idade: '30' })).toEqual({ nome: 'Ana', idade: 30 });
  });

  it('lança BadRequest com a lista de campos inválidos', () => {
    try {
      pipe.transform({ nome: '', idade: 'x' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const corpo = (e as BadRequestException).getResponse() as { erros: { campo: string }[] };
      expect(corpo.erros.map((x) => x.campo)).toEqual(['nome', 'idade']);
    }
  });
});
