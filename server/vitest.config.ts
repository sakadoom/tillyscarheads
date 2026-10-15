import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    // Semua test memakai satu database SQLite uji, jadi file dijalankan berurutan.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'rahasia-uji-jangan-dipakai-di-produksi',
    },
  },
});
