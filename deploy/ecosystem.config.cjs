// pm2 — os 4 processos do FotoRAW web. `pm2 start deploy/ecosystem.config.cjs`
// O server lê apps/server/.env (dotenv); os apps Nuxt recebem as URLs no build (deploy/.env.nuxt).
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
const nuxt = (nome, porta) => ({
  name: nome,
  cwd: path.join(raiz, 'apps', nome),
  script: '.output/server/index.mjs',
  env: { NODE_ENV: 'production', PORT: porta, HOST: '127.0.0.1', NITRO_PORT: porta, NITRO_HOST: '127.0.0.1' },
  instances: 1,
  autorestart: true,
  max_memory_restart: '400M',
  time: true,
});

module.exports = {
  apps: [
    {
      name: 'server',
      cwd: path.join(raiz, 'apps/server'),
      script: 'dist/main.js',
      env: { NODE_ENV: 'production', PORT: 3001 },
      // o limitador de tentativas de login é em memória: 1 instância
      instances: 1,
      autorestart: true,
      max_memory_restart: '600M',
      time: true,
    },
    nuxt('web', 3000),
    nuxt('fotografo', 3002),
    nuxt('admin', 3003),
  ],
};
