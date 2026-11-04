import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/auth';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  const session = await getServerSession();
  if (!session?.user) return null;
  const admin = await prisma.user.findUnique({ where: { id: session.user.id } });
  return admin?.role === 'admin' && admin.status === 'active' ? admin : null;
}

const userSelect = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { teams: true } },
} as const;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ users, currentUserId: admin.id });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const role = body.role;
  const status = body.status;
  if (!userId || !['user', 'admin'].includes(role) || !['active', 'suspended'].includes(status)) {
    return NextResponse.json({ error: 'Invalid user update' }, { status: 400 });
  }
  if (userId === admin.id && (role !== 'admin' || status !== 'active')) {
    return NextResponse.json({ error: 'You cannot remove your own admin access or suspend yourself.' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.role === 'admin' && (role !== 'admin' || status !== 'active')) {
    const otherAdmins = await prisma.user.count({
      where: { id: { not: userId }, role: 'admin', status: 'active' },
    });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: 'At least one active admin is required.' }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role, status },
    select: userSelect,
  });
  return NextResponse.json({ user });
}
