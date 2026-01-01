import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export interface User {
  id: string;
  username: string;
  password: string; // hashed
  leagueName: string;
  createdAt: Date;
}

export async function createUser(username: string, password: string): Promise<User | null> {
  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (existing) {
      return null;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        password: hashedPassword,
        leagueName: `${username}'s League`,
      },
    });

    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

export async function findUserByUsername(username: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    return user;
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

export async function validatePassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password);
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });

    return user;
  } catch (error) {
    console.error('Error finding user by ID:', error);
    return null;
  }
}

// For demo purposes - create a default user on server start (skip during build)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  // Only run in development, not during build
  if (!process.env.VERCEL_ENV) {
    (async () => {
      try {
        const existing = await findUserByUsername('demo');
        if (!existing) {
          await createUser('demo', 'demo1234');
          console.log('✅ Demo user created: username=demo, password=demo1234');
        }
      } catch (error) {
        console.error('Error creating demo user:', error);
      }
    })();
  }
}
