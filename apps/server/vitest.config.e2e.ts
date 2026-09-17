import { defineConfig } from 'vitest/config';

// E2E: sobem a app inteira contra o banco `fotoraw_test` (docker/docker-compose.yml).
// Rodam em série para não disputarem o mesmo banco.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/e2e/**/*.e2e-spec.ts'],
    setupFiles: ['test/setup-e2e.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
