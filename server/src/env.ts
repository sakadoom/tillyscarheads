import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvFile } from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Folder `server` (satu tingkat di atas `server/src`). */
export const serverRoot = path.resolve(here, '..');
/** Folder root monorepo tempat `.env` disimpan. */
export const repoRoot = path.resolve(serverRoot, '..');
/** Folder schema Prisma, sekaligus lokasi file database SQLite. */
export const prismaDir = path.join(serverRoot, 'prisma');

/**
 * Memuat `.env` dari root monorepo. Variabel yang sudah ada di lingkungan
 * (misalnya dari skrip test) tidak ditimpa.
 */
export function loadRootEnv(): void {
  loadEnvFile({ path: path.join(repoRoot, '.env'), quiet: true });
}
