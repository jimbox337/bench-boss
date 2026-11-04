import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/auth';
import { prisma } from '@/lib/prisma';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const [users, authUsers] = await Promise.all([
    prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    }),
    createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (authUsers.error) throw authUsers.error;
  const authEmails = new Set(authUsers.data.users.map(user => user.email?.toLowerCase()).filter(Boolean));

  return NextResponse.json({
    users: users.map(user => ({ ...user, authLinked: authEmails.has(user.email.toLowerCase()) })),
    currentUserId: admin.id,
  });
}

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const legacyUsers = await prisma.user.findMany({
    select: {
      email: true,
      password: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
      emailVerified: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  const supabase = createAdminClient();
  const authUsers = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authUsers.error) throw authUsers.error;
  const existingEmails = new Set(authUsers.data.users.map(user => user.email?.toLowerCase()).filter(Boolean));
  const results: Array<{ email: string; status: 'created' | 'existing' | 'failed'; error?: string }> = [];

  for (const user of legacyUsers) {
    const email = user.email.toLowerCase();
    if (existingEmails.has(email)) {
      results.push({ email, status: 'existing' });
      continue;
    }

    if (!/^\$2[aby]\$/.test(user.password)) {
      results.push({ email, status: 'failed', error: 'Unsupported password hash' });
      continue;
    }

    const created = await supabase.auth.admin.createUser({
      email,
      password_hash: user.password,
      email_confirm: Boolean(user.emailVerified),
      user_metadata: {
        username: user.username,
        first_name: user.firstName,
        last_name: user.lastName,
      },
      app_metadata: { role: user.role },
    });

    if (created.error) {
      results.push({ email, status: 'failed', error: created.error.message });
    } else {
      existingEmails.add(email);
      results.push({ email, status: 'created' });
    }
  }

  const failed = results.filter(result => result.status === 'failed');
  return NextResponse.json(
    {
      success: failed.length === 0,
      created: results.filter(result => result.status === 'created').length,
      existing: results.filter(result => result.status === 'existing').length,
      failed,
    },
    { status: failed.length ? 207 : 200 },
  );
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
