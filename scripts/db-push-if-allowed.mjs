// Runs `prisma db push` during builds, except on Vercel Preview/Development deployments.
// Preview builds must never push a branch's schema (with --accept-data-loss) to the shared
// production database, and they may not have the database variables at all.
// Local builds (no VERCEL_ENV) keep the previous behaviour.
import { spawnSync } from 'node:child_process';

const vercelEnv = process.env.VERCEL_ENV;

if (vercelEnv && vercelEnv !== 'production') {
  console.log(`Skipping prisma db push on Vercel ${vercelEnv} build.`);
  process.exit(0);
}

const result = spawnSync('npx', ['prisma', 'db', 'push', '--accept-data-loss'], { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
