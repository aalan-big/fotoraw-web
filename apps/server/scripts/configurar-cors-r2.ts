import 'dotenv/config';
import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
  type CORSRule,
} from '@aws-sdk/client-s3';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    endpoint: { type: 'string' },
    region: { type: 'string' },
    accessKey: { type: 'string' },
    secretKey: { type: 'string' },
    bucketPreviews: { type: 'string' },
    bucketOriginais: { type: 'string' },
  },
});

const endpoint = values.endpoint || process.env.STORAGE_ENDPOINT;
const region = values.region || process.env.STORAGE_REGION || 'auto';
const accessKeyId = values.accessKey || process.env.STORAGE_ACCESS_KEY;
const secretAccessKey = values.secretKey || process.env.STORAGE_SECRET_KEY;
const bucketPreviews = values.bucketPreviews || process.env.STORAGE_BUCKET_PREVIEWS || 'fotoraw-previews';
const bucketOriginais = values.bucketOriginais || process.env.STORAGE_BUCKET_ORIGINAIS || 'fotoraw-originais';

if (!endpoint || !accessKeyId || !secretAccessKey) {
  console.error('Erro: credenciais do storage não configuradas.');
  console.error('Defina STORAGE_ENDPOINT, STORAGE_ACCESS_KEY e STORAGE_SECRET_KEY no .env');
  console.error('ou passe via flags: --endpoint --accessKey --secretKey');
  process.exit(1);
}

const s3 = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
});

const regrasCors: CORSRule[] = [
  {
    AllowedHeaders: ['*'],
    AllowedMethods: ['GET', 'PUT', 'HEAD', 'POST', 'DELETE'],
    AllowedOrigins: ['*'],
    ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
    MaxAgeSeconds: 3600,
  },
];

async function configurarBucket(bucket: string) {
  console.log(`\nConfigurando CORS no bucket: "${bucket}"...`);
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: regrasCors,
        },
      }),
    );
    console.log(`[OK] Política de CORS aplicada com sucesso em "${bucket}".`);

    const corsAtual = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log(`[CONFIRMADO] Regras ativas em "${bucket}":`);
    console.log(JSON.stringify(corsAtual.CORSRules, null, 2));
  } catch (err) {
    console.error(`[ERRO] Falha ao configurar CORS no bucket "${bucket}":`, err instanceof Error ? err.message : err);
  }
}

async function main() {
  console.log('=== Configuração de CORS - Cloudflare R2 FotoRAW ===');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Bucket Previews: ${bucketPreviews}`);
  console.log(`Bucket Originais: ${bucketOriginais}`);

  await configurarBucket(bucketPreviews);
  await configurarBucket(bucketOriginais);

  console.log('\nProcesso finalizado.');
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
