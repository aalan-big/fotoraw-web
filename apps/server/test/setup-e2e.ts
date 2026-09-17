// Carrega .env.test antes de qualquer módulo subir.
import { config } from 'dotenv';

process.env.NODE_ENV = 'test';
config({ path: '.env.test', override: true });
