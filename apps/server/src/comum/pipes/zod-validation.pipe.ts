import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { type ZodType, z } from 'zod';
import { ptBR } from 'zod/locales';

// mensagens padrão do zod em português ("Informe um número" em vez de "expected number")
z.config(ptBR());

/**
 * Valida body/query/params com um schema zod. Os DTOs de cada módulo são
 * schemas zod (compartilháveis com `packages/contratos`), não classes.
 *
 *   @Post()
 *   criar(@Body(new ZodValidationPipe(criarGaleriaSchema)) dto: CriarGaleriaDto) {}
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(valor: unknown): T {
    const resultado = this.schema.safeParse(valor);
    if (!resultado.success) {
      throw new BadRequestException({
        mensagem: 'Dados inválidos',
        erros: resultado.error.issues.map((i) => ({
          campo: i.path.join('.'),
          mensagem: i.message,
        })),
      });
    }
    return resultado.data;
  }
}
