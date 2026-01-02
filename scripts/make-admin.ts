import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function makeAdmin() {
  const username = process.argv[2];

  if (!username) {
    console.error('Usage: npx tsx scripts/make-admin.ts <username>');
    process.exit(1);
  }

  try {
    const user = await prisma.user.update({
      where: { username: username.toLowerCase() },
      data: { role: 'admin' },
    });

    console.log(`✅ User "${user.username}" is now an admin!`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
