import { prisma } from '@/lib/prisma';
import { createClient } from './server';

export async function getServerSession() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  const metadata = authUser.user_metadata || {};
  let user = await prisma.user.findUnique({ where: { email: authUser.email.toLowerCase() } });
  if (!user) {
    const base = String(metadata.username || authUser.email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
    user = await prisma.user.create({
      data: {
        username: `${base}_${authUser.id.slice(0, 8)}`,
        email: authUser.email.toLowerCase(),
        firstName: metadata.first_name || metadata.full_name?.split(' ')[0] || base,
        lastName: metadata.last_name || null,
        password: '',
        profilePicture: metadata.avatar_url || null,
        emailVerified: authUser.email_confirmed_at ? new Date(authUser.email_confirmed_at) : new Date(),
      },
    });
  }

  if (user.status !== 'active') return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      image: user.profilePicture,
      role: user.role,
    },
  };
}
