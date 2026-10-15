import path from 'node:path';
import { loadRootEnv, prismaDir } from './env.js';

loadRootEnv();

function required(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Konfigurasi tidak lengkap: variabel lingkungan ${name} wajib diisi. ` +
        'Salin .env.example menjadi .env di root proyek lalu isi nilainya (JWT_SECRET harus berupa string acak).',
    );
  }
  return value;
}

/**
 * URL SQLite relatif diubah ke path absolut supaya file database selalu berada
 * di `server/prisma`, tidak peduli dari folder mana proses dijalankan.
 */
function resolveDatabaseUrl(raw: string): string {
  if (!raw.startsWith('file:')) return raw;
  const filePath = raw.slice('file:'.length);
  if (path.isAbsolute(filePath)) return raw;
  return `file:${path.resolve(prismaDir, filePath).split(path.sep).join('/')}`;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  /** Batas percobaan pada rute autentikasi per 15 menit. */
  authRateLimit: Number(process.env.RATE_LIMIT_MAX ?? 200),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: '12h' as const,
  databaseUrl: resolveDatabaseUrl(required('DATABASE_URL')),
  bcryptRounds: 10,
  isTest: process.env.NODE_ENV === 'test',
};
