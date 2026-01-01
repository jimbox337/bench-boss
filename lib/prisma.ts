import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Skip Prisma initialization during build if DATABASE_URL is not a valid Postgres URL
const isDuringBuild = process.env.NEXT_PHASE === 'phase-production-build';
const isValidPostgresUrl = process.env.DATABASE_URL?.startsWith('postgres://') ||
                           process.env.DATABASE_URL?.startsWith('postgresql://');

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
