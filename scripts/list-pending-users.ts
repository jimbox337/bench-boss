import { prisma } from '../lib/prisma';

async function listPendingUsers() {
  try {
    const pendingUsers = await prisma.pendingUser.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (pendingUsers.length === 0) {
      console.log('No pending users found');
      await prisma.$disconnect();
      return;
    }

    console.log(`\n📋 Found ${pendingUsers.length} pending user(s):\n`);

    pendingUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user.email})`);
      console.log(`   Created: ${user.createdAt.toLocaleString()}`);
      console.log(`   Expires: ${user.verificationExpires.toLocaleString()}`);
      console.log(`   Token: ${user.verificationToken.substring(0, 16)}...`);
      console.log('');
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error listing pending users:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

listPendingUsers();
