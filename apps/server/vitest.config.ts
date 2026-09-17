import { defineConfig } from 'vitest/config';

// Unitários: ficam ao lado do código (src/**/*.spec.ts). Não tocam banco nem rede.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/infra/prisma/gerado/**', 'src/main.ts'],
    },
  },
});
