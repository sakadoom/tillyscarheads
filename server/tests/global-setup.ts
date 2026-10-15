import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');
const repoRoot = path.resolve(serverRoot, '..');
const prismaCli = path.join(repoRoot, 'node_modules', 'prisma', 'build', 'index.js');
const generatedClient = path.join(repoRoot, 'node_modules', '.prisma', 'client', 'index.js');

/**
 * Database uji terpisah dari dev.db: `server/prisma/test.db`. Skemanya dibuat
 * ulang tiap kali test dijalankan supaya hasilnya deterministik.
 */
export default function setup(): void {
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./test.db',
    JWT_SECRET: process.env.JWT_SECRET ?? 'rahasia-uji-jangan-dipakai-di-produksi',
  };
  const run = (args: string[]): void => {
    execFileSync(process.execPath, [prismaCli, ...args], { cwd: serverRoot, env, stdio: 'pipe' });
  };

  if (!existsSync(generatedClient)) {
    run(['generate', '--schema', 'prisma/schema.prisma']);
  }
  run(['db', 'push', '--force-reset', '--skip-generate', '--schema', 'prisma/schema.prisma']);
}
