import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find user by username or email
  const username = process.argv[2];

  if (!username) {
    console.error('Usage: npx tsx scripts/make-admin.ts <username-or-email>');
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: username },
        { email: username },
      ],
    },
  });

  if (!user) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  // Update user to admin
  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'admin' },
  });

  console.log(`✅ User ${user.username} (${user.email}) is now an admin!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
