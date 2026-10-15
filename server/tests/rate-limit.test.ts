import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Batas percobaan dibuat kecil lewat RATE_LIMIT_MAX supaya perilaku 429 bisa
 * diuji tanpa mengirim ratusan permintaan. Nilai default di produksi tetap 200
 * (lihat server/src/config.ts).
 */
let app: Express;

beforeAll(async () => {
  process.env.RATE_LIMIT_MAX = '3';
  const { createApp } = await import('../src/app.js');
  app = createApp();
});

describe('rate limit autentikasi', () => {
  it('membatasi percobaan masuk berulang', async () => {
    const attempt = () =>
      request(app)
        .post('/api/auth/login')
        .send({ email: 'tidak-ada@example.com', password: 'Password123' });

    const first = await attempt();
    const second = await attempt();
    const third = await attempt();
    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(third.status).toBe(401);

    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});
