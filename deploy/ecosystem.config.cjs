// pm2 — os 4 processos do FotoRAW web. `pm2 start deploy/ecosystem.config.cjs`
// O server lê apps/server/.env (dotenv); os apps Nuxt recebem as URLs no build (deploy/.env.nuxt).
const path = require('node:path');
const fs = require('node:fs');
const raiz = path.resolve(__dirname, '..');
// node 22 isolado em /opt/node22 (instalar-vps.sh); fora da VPS usa o node do PATH
const interpreter = fs.existsSync('/opt/node22/bin/node') ? '/opt/node22/bin/node' : 'node';
// portas vêm de deploy/.env.nuxt (publicar.sh carrega antes do pm2); padrão 4000–4003
const porta = (nome, padrao) => Number(process.env[nome] ?? padrao);
const PORTAS = {
  web: porta('PORTA_WEB', 4000),
  api: porta('PORTA_API', 4001),
  fotografo: porta('PORTA_PAINEL', 4002),
  admin: porta('PORTA_ADMIN', 4003),
};
const nuxt = (nome, porta) => ({
  name: nome,
  cwd: path.join(raiz, 'apps', nome),
  script: '.output/server/index.mjs',
  interpreter,
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
      interpreter,
      env: { NODE_ENV: 'production', PORT: PORTAS.api },
      // o limitador de tentativas de login é em memória: 1 instância
      instances: 1,
      autorestart: true,
      max_memory_restart: '600M',
      time: true,
    },
    nuxt('web', PORTAS.web),
    nuxt('fotografo', PORTAS.fotografo),
    nuxt('admin', PORTAS.admin),
  ],
};
