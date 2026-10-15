import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../src/db.js';
import { app, authHeader, DEMO_PASSWORD, registerUser, resetDatabase } from './helpers.js';

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('autentikasi', () => {
  it('menjawab status sehat tanpa token', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('mendaftarkan pengguna baru dan menyimpan password sebagai hash', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Rina Wijaya',
      email: 'rina@example.com',
      password: DEMO_PASSWORD,
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTypeOf('string');
    expect(response.body.user).toMatchObject({ name: 'Rina Wijaya', email: 'rina@example.com' });
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'rina@example.com' } });
    expect(stored.passwordHash).not.toBe(DEMO_PASSWORD);
    expect(stored.passwordHash.startsWith('$2')).toBe(true);
  });

  it('menolak email yang sudah terdaftar', async () => {
    await registerUser('sama@example.com');
    const response = await request(app).post('/api/auth/register').send({
      name: 'Pengguna Lain',
      email: 'sama@example.com',
      password: DEMO_PASSWORD,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('menolak password kurang dari 8 karakter', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Pengguna', email: 'pendek@example.com', password: 'abc123' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.fields.password).toBeDefined();
  });

  it('masuk dengan password benar dan menolak yang salah', async () => {
    const user = await registerUser('login@example.com');

    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'PasswordSalah9' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'tidak-ada@example.com', password: DEMO_PASSWORD });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).not.toMatch(/tidak terdaftar/i);

    const success = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: DEMO_PASSWORD });
    expect(success.status).toBe(200);
    expect(success.body.token).toBeTypeOf('string');
    expect(success.body.user.id).toBe(user.userId);
  });

  it('menolak akses tanpa token atau dengan token yang rusak', async () => {
    const anonymous = await request(app).get('/api/auth/me');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('UNAUTHORIZED');

    const broken = await request(app).get('/api/auth/me').set(authHeader('token-palsu'));
    expect(broken.status).toBe(401);

    const noBearer = await request(app)
      .get('/api/auth/me')
      .set({ Authorization: 'token-tanpa-bearer' });
    expect(noBearer.status).toBe(401);
  });

  it('mengembalikan data pengguna yang sedang masuk', async () => {
    const user = await registerUser('me@example.com');
    const response = await request(app).get('/api/auth/me').set(authHeader(user.token));

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: user.userId, email: user.email });
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('menjawab 404 untuk endpoint yang tidak ada setelah terautentikasi', async () => {
    const user = await registerUser('endpoint@example.com');
    const response = await request(app).get('/api/tidak-ada').set(authHeader(user.token));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');

    // Tanpa sesi, permintaan ditolak lebih dahulu sehingga daftar endpoint
    // tidak terbocorkan.
    const anonymous = await request(app).get('/api/tidak-ada');
    expect(anonymous.status).toBe(401);
  });
});
