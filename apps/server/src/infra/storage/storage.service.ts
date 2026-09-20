import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { urlPublica } from './urls.js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  public readonly bucketPreviews: string;
  public readonly bucketOriginais: string;
  public readonly urlBasePreviews: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const endpoint = this.config.get('STORAGE_ENDPOINT');
    const region = this.config.get('STORAGE_REGION');
    const accessKeyId = this.config.get('STORAGE_ACCESS_KEY');
    const secretAccessKey = this.config.get('STORAGE_SECRET_KEY');

    this.bucketPreviews = this.config.get('STORAGE_BUCKET_PREVIEWS');
    this.bucketOriginais = this.config.get('STORAGE_BUCKET_ORIGINAIS');
    this.urlBasePreviews = this.config.get('STORAGE_PREVIEWS_URL_PUBLICA');

    this.s3 = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  /**
   * Gera uma URL pré-assinada para upload via PUT direto do cliente/desktop.
   */
  async gerarUrlUpload(
    bucket: string,
    chave: string,
    tipoMime = 'image/jpeg',
    expiraEmSegundos = 3600,
  ): Promise<string> {
    const comando = new PutObjectCommand({
      Bucket: bucket,
      Key: chave,
      ContentType: tipoMime,
    });

    return getSignedUrl(this.s3, comando, { expiresIn: expiraEmSegundos });
  }

  /**
   * Verifica se um objeto já foi enviado para o bucket (via HEAD).
   */
  async verificarObjetoExiste(bucket: string, chave: string): Promise<boolean> {
    try {
      const comando = new HeadObjectCommand({
        Bucket: bucket,
        Key: chave,
      });
      await this.s3.send(comando);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gera URL pré-assinada para download privado de arquivo original em alta.
   */
  async gerarUrlDownloadAssinada(
    bucket: string,
    chave: string,
    expiraEmSegundos = 3600,
  ): Promise<string> {
    const comando = new GetObjectCommand({
      Bucket: bucket,
      Key: chave,
    });

    return getSignedUrl(this.s3, comando, { expiresIn: expiraEmSegundos });
  }

  /**
   * Monta a URL pública para um preview.
   */
  urlPublicaPreview(chave: string | null): string | null {
    return urlPublica(this.urlBasePreviews, chave);
  }
}
