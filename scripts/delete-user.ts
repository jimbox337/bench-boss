import { prisma } from '../lib/prisma';

async function deleteUser() {
  const email = process.argv[2];
  const username = process.argv[3];

  if (!email && !username) {
    console.error('Usage: npx tsx scripts/delete-user.ts <email-or-username>');
    console.error('Example: npx tsx scripts/delete-user.ts user@example.com');
    console.error('Example: npx tsx scripts/delete-user.ts myusername');
    process.exit(1);
  }

  try {
    const identifier = email || username;

    // Try to find by email first
    let user = await prisma.user.findUnique({
      where: { email: identifier.toLowerCase() },
    });

    // If not found by email, try username
    if (!user) {
      user = await prisma.user.findUnique({
        where: { username: identifier.toLowerCase() },
      });
    }

    if (!user) {
      console.log(`❌ No user found with identifier: ${identifier}`);

      // Also check pending users
      let pendingUser = await prisma.pendingUser.findUnique({
        where: { email: identifier.toLowerCase() },
      });

      if (!pendingUser) {
        pendingUser = await prisma.pendingUser.findUnique({
          where: { username: identifier.toLowerCase() },
        });
      }

      if (pendingUser) {
        console.log(`Found pending user: ${pendingUser.email} (${pendingUser.username})`);
        console.log('Deleting pending user...');
        await prisma.pendingUser.delete({
          where: { id: pendingUser.id },
        });
        console.log('✅ Pending user deleted successfully');
      }

      await prisma.$disconnect();
      process.exit(0);
    }

    console.log(`Found user: ${user.email} (${user.username})`);
    console.log(`Created: ${user.createdAt}`);
    console.log(`Email verified: ${user.emailVerified || 'Not verified'}`);

    console.log('\nDeleting user...');
    await prisma.user.delete({
      where: { id: user.id },
    });

    console.log('✅ User deleted successfully');
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error deleting user:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

deleteUser();
