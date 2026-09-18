import { Injectable } from '@nestjs/common';
import { argon2id, hash as argonHash, verify as argonVerify, type HashOptions } from 'argon2';

/**
 * Hash e verificação de senha com argon2id — memória 64 MB, 3 iterações, 1 thread
 * (recomendação OWASP; ~100 ms por hash). O desktop usa os mesmos parâmetros no
 * hash local pro login offline.
 */
@Injectable()
export class SenhaService {
  private readonly opcoes: HashOptions = {
    type: argon2id,
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 1,
  };

  hash(senha: string): Promise<string> {
    return argonHash(senha, this.opcoes);
  }

  /** Nunca lança: hash malformado no banco conta como senha errada. */
  async conferir(hash: string, senha: string): Promise<boolean> {
    try {
      return await argonVerify(hash, senha);
    } catch {
      return false;
    }
  }
}
