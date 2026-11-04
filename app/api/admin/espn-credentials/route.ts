import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/auth';
import { prisma } from '@/lib/prisma';
import { encryptCredential, isEncryptedCredential } from '@/lib/espnCredentials';

async function requireAdmin() {
  const session = await getServerSession();
  if (!session?.user) return null;
  const admin = await prisma.user.findUnique({ where: { id: session.user.id } });
  return admin?.role === 'admin' && admin.status === 'active' ? admin : null;
}

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const teams = await prisma.team.findMany({
    where: { platform: 'ESPN', OR: [{ espnS2: { not: null } }, { swid: { not: null } }] },
    select: { id: true, espnS2: true, swid: true },
  });

  let secured = 0;
  for (const team of teams) {
    const needsMigration =
      (Boolean(team.espnS2) && !isEncryptedCredential(team.espnS2)) ||
      (Boolean(team.swid) && !isEncryptedCredential(team.swid));
    if (!needsMigration) continue;

    await prisma.team.update({
      where: { id: team.id },
      data: {
        espnS2: team.espnS2 && !isEncryptedCredential(team.espnS2) ? encryptCredential(team.espnS2) : undefined,
        swid: team.swid && !isEncryptedCredential(team.swid) ? encryptCredential(team.swid) : undefined,
      },
    });
    secured += 1;
  }

  return NextResponse.json({ success: true, secured });
}
